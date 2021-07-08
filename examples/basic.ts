import { Session } from "../src/session";

const session = new Session({
  clientId: "client-id",
  returnUrl: "https://app.example.com/return",
  scopes: ["openid", "offline_access"],
  openidConfiguration: {
    authorizationEndpoint: "https://provider.example.com/auth",
    tokenEndpoint: "https://provider.example.com/token",
    endSessionEndpoint: "https://provider.example.com/session/end",
  },
});

session.onChange((accessToken) => {
  // Called every time a new token is issued
  // Or `null` if the session doesn't exist
  console.log("New access token issued:", accessToken);
});

document.getElementById("login-button").addEventListener("click", () => {
  // Starts the login flow
  session.login();
});
