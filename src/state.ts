export interface State {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: string;
  refresh_token: string;
}

export function mapResponseToState(response: TokenResponse): State {
  return {
    accessToken: response.access_token,
    expiresAt: Date.now() + Number(response.expires_in) * 1000,
    refreshToken: response.refresh_token,
  };
}

export function hasStateExpired(state: State): boolean {
  return Date.now() > state.expiresAt;
}

export function restoreState(key: string): State | null {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "");
  } catch {
    return null;
  }
}

export function persistState(key: string, state: State | null): void {
  if (state === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, JSON.stringify(state));
}
