import { Session } from "../src/session.js";

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

session.onChange((accessToken) => {
  // Called every time a new token is issued
  // Or `null` if a session doesn't exist
  console.log("New access token issued:", accessToken);
});

document.getElementById("login-button")!.addEventListener("click", () => {
  // Starts the login flow
  session.login();
});
