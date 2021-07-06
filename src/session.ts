import { fromEvent, Observable, ReplaySubject } from "rxjs";
import { filter, map } from "rxjs/operators";
import * as Lock from "./lock";
import {
  hasStateExpired,
  mapResponseToState,
  persistState,
  restoreState,
  State,
} from "./state";

export interface Config {
  clientId: string;
  returnUrl: string;
  scopes: string[];
  openidConfiguration: {
    authorizationUrl: string;
    tokenUrl: string;
    endSessionUrl: string;
  };
}

enum InternalError {
  ExchangeError,
  ExchangeInProgress,
}

/**
 * Session manager
 */
export class Session {
  #config: Config;
  #key: string;
  #stateStream: ReplaySubject<State | null>;
  /** Stream of access tokens. */
  stream: Observable<string | null>;

  constructor(config: Config) {
    this.#config = config;
    this.#key = "session_state";
    this.#stateStream = new ReplaySubject(1);

    // Publish access token updates
    this.stream = this.#stateStream.pipe(
      map((state) => (state ? state.accessToken : null))
    );

    // Resolve initial state
    const returnedCodes = getReturnedCodes();
    const restoredState = restoreState(this.#key);

    if (returnedCodes) {
      // When an auth code is present in the redirect
      this.#exchangeAuthorizationCode(returnedCodes[0], returnedCodes[1])
        .then((state) => this.#next(state))
        .catch(() => this.#next(null));
    } else if (restoredState) {
      // When state exists in store
      if (hasStateExpired(restoredState)) {
        this.#exchangeRefreshToken(restoredState)
          .then((state) => this.#next(state))
          .catch((error) => {
            // Storage listener will pick up in progress exchange from other tabs
            if (error === InternalError.ExchangeInProgress) return;
            this.#next(null);
          });
      } else {
        this.#next(restoredState, false);
      }
    } else {
      // When neither of those are true
      this.#next(null, false);
    }

    // Expiring timer for refreshing token
    let expiringTimer: number | undefined;
    this.#stateStream.subscribe((state) => {
      if (expiringTimer) clearTimeout(expiringTimer);
      if (state)
        expiringTimer = setTimeout(() => {
          expiringTimer = undefined;
          this.#exchangeRefreshToken(state)
            .then((state) => this.#next(state))
            .catch((error) => {
              // Ignore and leave the expiry timer to handle
              // Another tab may succeed refreshing
            });
        }, state.expiresAt - Date.now() - 30 * 1000);
    });

    // Expired timer
    let expiredTimer: number | undefined;
    this.#stateStream.subscribe((state) => {
      if (expiredTimer) clearTimeout(expiredTimer);
      if (state)
        expiredTimer = setTimeout(() => {
          expiredTimer = undefined;
          this.#next(null);
        }, state.expiresAt - Date.now());
    });

    // TODO: Try and get this working both expiring/expired:
    // this.#stateStream
    //   .pipe(
    //     map((state) => (state ? state.expiresAt : Number.MAX_SAFE_INTEGER)),
    //     switchMap((expiresAt) => timer(expiresAt - Date.now()))
    //   )
    //   .subscribe(() => this.#next(null));

    // Syncronise cross-tab state changes
    fromEvent<StorageEvent>(window, "storage")
      .pipe(filter((event) => event.key === this.#key))
      .subscribe(() => {
        this.#next(restoreState(this.#key), false);
      });
  }

  /**
   * Login to the auth provider
   */
  async login(): Promise<void> {
    const stateToken = generateStateToken();
    const [codeVerifier, codeChallenge] = await generatePKCETokens();

    // TODO: Removed expired state tokens
    window.sessionStorage.setItem("oidc:" + stateToken, codeVerifier);

    const params = new URLSearchParams({
      client_id: this.#config.clientId,
      response_type: "code",
      redirect_uri: this.#config.returnUrl,
      scope: this.#config.scopes.join(" "),
      state: stateToken,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.replace(
      `${this.#config.openidConfiguration.authorizationUrl}?${params}`
    );
  }

  /**
   * Logout from the auth provider
   */
  async logout(): Promise<void> {
    this.#next(null);
    window.location.replace(this.#config.openidConfiguration.endSessionUrl);
  }

  /**
   * Exchange authorisation code for state
   */
  async #exchangeAuthorizationCode(
    code: string,
    stateToken: string
  ): Promise<State> {
    // TODO: proper flow state management
    const codeVerifier = window.sessionStorage.getItem("oidc:" + stateToken)!;

    const response = await fetch(this.#config.openidConfiguration.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.#config.clientId,
        redirect_uri: this.#config.returnUrl,
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
      }),
    });
    if (!response.ok) throw InternalError.ExchangeError;

    return mapResponseToState(await response.json());
  }

  /**
   * Exchange refresh token for state
   */
  async #exchangeRefreshToken(state: State): Promise<State> {
    const lockKey = "refresh_lock";

    const acquiredLock = await Lock.acquire(lockKey);
    if (!acquiredLock) {
      throw InternalError.ExchangeInProgress;
    }

    try {
      const response = await fetch(this.#config.openidConfiguration.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.#config.clientId,
          grant_type: "refresh_token",
          refresh_token: state.refreshToken,
        }),
      });
      if (!response.ok) throw InternalError.ExchangeError;

      return mapResponseToState(await response.json());
    } finally {
      Lock.release(lockKey);
    }
  }

  #next(state: State | null, persist = true): void {
    this.#stateStream.next(state);
    if (persist) persistState(this.#key, state);
  }
}

function getReturnedCodes(): [string, string] | null {
  const params = new URL(window.location.href).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  return code && state ? [code, state] : null;
}

function generateStateToken(): string {
  return randomToken(12);
}

async function generatePKCETokens(): Promise<[string, string]> {
  const codeVerifier = randomToken(128);

  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return [codeVerifier, codeChallenge];
}

function randomToken(
  size: number,
  mask = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
): string {
  return crypto
    .getRandomValues(new Uint8Array(size))
    .reduce((buffer, nextValue) => buffer + mask[nextValue % mask.length], "");
}
