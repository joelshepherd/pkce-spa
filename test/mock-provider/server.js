import { Provider } from "oidc-provider";

const port = 8081;

const provider = new Provider(`http://localhost:${port}`, {
  clients: [
    {
      client_id: "client-id",
      grant_types: ["authorization_code", "refresh_token"],
      post_logout_redirect_uris: ["http://localhost:8080/"],
      redirect_uris: ["http://localhost:8080/"],
      token_endpoint_auth_method: "none",
    },
  ],
  clientBasedCORS: () => true,
  ttl: {
    AccessToken: 35, // seconds
  },
});

provider.listen(port, () => {
  console.log(
    `mock-provider listening on port ${port}, check http://localhost:${port}/.well-known/openid-configuration`
  );
});
