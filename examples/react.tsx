import React from "react";
import { Session } from "../src/session.js";

// Setup the session
const session = new Session({
  clientId: "client-id",
  returnUrl: "https://app.example.com/return",
  scopes: ["openid", "offline_access"],
  openidConfiguration: {
    authorizationEndpoint: "https://auth.example.com/auth",
    tokenEndpoint: "https://auth.example.com/token",
    endSessionEndpoint: "https://auth.example.com/session/end",
  },
});

/**
 * The main app scaffold
 */
function App() {
  return (
    <TokenProvider>
      <Authenticate />
    </TokenProvider>
  );
}

const Token = React.createContext<string | null>(null);

/**
 * Provide the access token from the session to the app
 */
function TokenProvider({ children }: React.PropsWithChildren<{}>) {
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => session.onChange(setToken), []);

  return <Token.Provider value={token}>{children}</Token.Provider>;
}

/**
 * Display a login or logout button
 */
function Authenticate() {
  const token = React.useContext(Token);

  return token !== null ? (
    <button onClick={() => session.login()}>Login</button>
  ) : (
    <button onClick={() => session.logout()}>Logout</button>
  );
}
