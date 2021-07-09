import * as Lock from "./lock.js";
import {
  hasStateExpired,
  mapResponseToState,
  persistState,
  restoreState,
  State,
} from "./state.js";

export interface Config {
  /** Client ID */
  clientId: string;
  /** Return URL */
  returnUrl: string;
  /** Post logout URL */
  postLogoutUrl?: string;
  /** List of scopes */
  scopes: string[];
  /** OpenID Connect configuration */
  openidConfiguration: {
    /** Authorization endpoint */
    authorizationEndpoint: string;
    /** Token endpoint */
    tokenEndpoint: string;
    /** End session endpoint */
    endSessionEndpoint: string;
  };
  extraAuthorizationParams?: Record<string, string>;
}

enum InternalError {
  ExchangeError,
  ExchangeInProgress,
}

type AccessTokenListener = (accessToken: string | null) => void;
type StateListener = (state: State | null) => void;
type UnsubscribeListener = () => void;

/**
 * Session manager
 */
export class Session {
  #config: Config;
  #key: string;
  #accessToken?: string | null;
  #accessTokenListeners: AccessTokenListener[];
  #stateListeners: StateListener[];

  constructor(config: Config) {
    this.#config = config;
    this.#key = "session_state";
    this.#accessTokenListeners = [];

    // State change watchers
    let expiringTimer: number | undefined;
    let expiredTimer: number | undefined;
    this.#stateListeners = [
      // Publish access token changes
      (state) => this.#nextAccessToken(state ? state.accessToken : null),
      // Expiring timer for refreshing token
      (state) => {
        if (expiringTimer) clearTimeout(expiringTimer);
        if (state)
          expiringTimer = setTimeout(() => {
            expiringTimer = undefined;
            this.#exchangeRefreshToken(state)
              .then((state) => this.#nextState(state))
              .catch((error) => {
                // Ignore and leave the expiry timer to handle
                // Another tab may succeed refreshing
              });
          }, state.expiresAt - Date.now() - 30 * 1000);
      },
      // Expired timer
      (state) => {
        if (expiredTimer) clearTimeout(expiredTimer);
        if (state)
          expiredTimer = setTimeout(() => {
            expiredTimer = undefined;
            this.#nextState(null);
          }, state.expiresAt - Date.now());
      },
    ];

    // Syncronise cross-tab state changes
    window.addEventListener("storage", (event) => {
      if (event.key === this.#key) {
        this.#nextState(restoreState(this.#key), false);
      }
    });

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
      ...this.#config.extraAuthorizationParams,
    });

    window.location.replace(
      `${this.#config.openidConfiguration.authorizationEndpoint}?${params}`
    );
  }

  /**
   * Logout from the auth provider
   */
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
   *
   * @returns A function to unsubscribe
   */
  onChange(listener: AccessTokenListener): UnsubscribeListener {
    this.#accessTokenListeners.push(listener);

    const unsubscribe = () => {
      this.#accessTokenListeners = this.#accessTokenListeners.filter(
        (filter) => filter !== listener
      );
    };

    // Replay access token if one exists
    if (this.#accessToken !== undefined) listener(this.#accessToken);

    return unsubscribe;
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
      if (!response.ok) throw InternalError.ExchangeError;

      return mapResponseToState(await response.json());
    } finally {
      Lock.release(lockKey);
    }
  }

  #nextState(state: State | null, persist = true): void {
    this.#stateListeners.forEach((listener) => listener(state));
    if (persist) persistState(this.#key, state);
  }

  #nextAccessToken(accessToken: string | null): void {
    this.#accessToken = accessToken;
    this.#accessTokenListeners.forEach((listener) => listener(accessToken));
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
