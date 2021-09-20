import { InvalidStateError } from "./error.js";
import { Lock } from "./lock.js";
import {
  hasStateExpired,
  mapResponseToState,
  persistState,
  restoreState,
  State,
} from "./state.js";
import { Sink, Stream, Unsubscribe } from "./stream.js";

export interface Config {
  /** Client ID */
  clientId: string;
  /** Return URL */
  returnUrl: string;
  /** Post logout URL */
  postLogoutUrl?: string;
  /** List of scopes */
  scopes: string[];
  /** OpenID Connect configuration document */
  openidConfiguration: {
    /** Authorization endpoint */
    authorizationEndpoint: string;
    /** Token endpoint */
    tokenEndpoint: string;
    /** End session endpoint */
    endSessionEndpoint: string;
  };
  /** Extra parameters to pass to the authorization request */
  extraAuthorizationParams?: Record<string, string>;
}

type AccessToken = string | null;

enum InternalError {
  ExchangeError,
  ExchangeInProgress,
}

/**
 * Session manager
 */
export class Session {
  #config: Config;
  #key = "session_state";
  #refreshLock = new Lock("session_refresh_lock", 200);
  #accessToken = new Stream<AccessToken>();
  #state = new Stream<State | null>();

  constructor(config: Config) {
    this.#config = config;

    // Syncronise cross-tab state changes
    window.addEventListener("storage", (event) => {
      if (event.key === this.#key) {
        this.#nextState(restoreState(this.#key), false);
      }
    });

    // Expiring timer for refreshing token
    let expiringTimer: number | undefined;
    this.#state.subscribe((state) => {
      if (expiringTimer) clearTimeout(expiringTimer);
      if (state)
        expiringTimer = setTimeout(() => {
          expiringTimer = undefined;
          this.#exchangeRefreshToken(state)
            .then((state) => this.#nextState(state))
            .catch(() => {
              // Ignore error and leave it to the expired timer to handle
              // Another tab may succeed refreshing in the meantime
            });
        }, state.expiresAt - Date.now() - 30 * 1000);
    });

    // Expired timer
    let expiredTimer: number | undefined;
    this.#state.subscribe((state) => {
      if (expiredTimer) clearTimeout(expiredTimer);
      if (state)
        expiredTimer = setTimeout(() => {
          expiredTimer = undefined;
          this.#nextState(null);
        }, state.expiresAt - Date.now());
    });

    // Publish access token changes
    this.#state.subscribe((state) =>
      this.#accessToken.next(state ? state.accessToken : null)
    );

    // Resolve initial state
    const returnedCodes = getReturnedCodes();
    const restoredState = restoreState(this.#key);

    if (returnedCodes) {
      // When an auth code is present in the redirect
      this.#exchangeAuthorizationCode(returnedCodes[0], returnedCodes[1])
        .then((state) => this.#nextState(state))
        .catch(() => this.#nextState(null));
    } else if (restoredState) {
      // When state exists in store
      if (hasStateExpired(restoredState)) {
        this.#exchangeRefreshToken(restoredState)
          .then((state) => this.#nextState(state))
          .catch((error) => {
            // Storage listener will pick up in progress exchange from other tabs
            if (error === InternalError.ExchangeInProgress) return;
            this.#nextState(null);
          });
      } else {
        this.#nextState(restoredState, false);
      }
    } else {
      // When neither of those are true
      this.#nextState(null, false);
    }
  }

  /** Login to the auth provider */
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
      ...this.#config.extraAuthorizationParams,
    });

    window.location.replace(
      `${this.#config.openidConfiguration.authorizationEndpoint}?${params}`
    );
  }

  /** Logout from the auth provider */
  async logout(): Promise<void> {
    // Clear persisted state
    persistState(this.#key, null);

    const params = new URLSearchParams(
      this.#config.postLogoutUrl
        ? {
            client_id: this.#config.clientId,
            post_logout_redirect_uri: this.#config.postLogoutUrl,
          }
        : {}
    );

    window.location.replace(
      `${this.#config.openidConfiguration.endSessionEndpoint}?${params}`
    );
  }

  /**
   * Listen for changes to the access token
   * @returns An unsubscribe function
   */
  onChange(sink: Sink<AccessToken>): Unsubscribe {
    return this.#accessToken.subscribe(sink);
  }

  /** Exchange authorisation code for state */
  async #exchangeAuthorizationCode(
    code: string,
    stateToken: string
  ): Promise<State> {
    // TODO: abstract code storage
    const codeVerifier = window.sessionStorage.getItem("oidc:" + stateToken);

    if (!codeVerifier) throw new InvalidStateError();

    const response = await fetch(
      this.#config.openidConfiguration.tokenEndpoint,
      {
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
      }
    );

    // TODO: Convert to external errors
    if (!response.ok) throw InternalError.ExchangeError;

    return mapResponseToState(await response.json());
  }

  /** Exchange refresh token for state */
  async #exchangeRefreshToken(state: State): Promise<State> {
    const acquiredLock = await this.#refreshLock.acquire(state.refreshToken);
    if (!acquiredLock) {
      throw InternalError.ExchangeInProgress;
    }

    try {
      const response = await fetch(
        this.#config.openidConfiguration.tokenEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: this.#config.clientId,
            grant_type: "refresh_token",
            refresh_token: state.refreshToken,
          }),
        }
      );

      // TODO: Expose public token refresh failure reasons
      if (!response.ok) throw InternalError.ExchangeError;

      return mapResponseToState(await response.json());
    } catch (error) {
      // Only release the lock against this refresh token if we were unable to exchange
      this.#refreshLock.release();
      throw error;
    }
  }

  /** Push next state and persist */
  #nextState(state: State | null, persist = true): void {
    this.#state.next(state);
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
