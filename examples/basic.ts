import { Session } from "../src/session";

const session = new Session({} as any);

session.stream.subscribe((accessToken) => {
  // Called every time a new token is issued
  console.log("New access token issued:", accessToken);
});

const button = document.getElementById("login-button");
button.addEventListener("click", () => {
  // Starts the login flow
  session.login();
});
