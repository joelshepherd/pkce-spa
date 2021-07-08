import { Session } from "../src/session";

const session = new Session({
  clientId: "client-id",
  returnUrl: "http://localhost:5000/test/",
  scopes: ["openid", "offline_access"],
  openidConfiguration: {
    authorizationEndpoint: "http://localhost:4444/auth",
    tokenEndpoint: "http://localhost:4444/token",
    endSessionEndpoint: "http://localhost:4444/session/end",
  },
});

session.onChange((accessToken) => {
  // Called every time a new token is issued
  console.log("New access token issued:", accessToken);
});

document.getElementById("login-button").addEventListener("click", () => {
  // Starts the login flow
  session.login();
});
