import { Provider } from "oidc-provider";

const port = 5001;

const provider = new Provider(`http://localhost:${port}`, {
  clients: [
    {
      client_id: "client-id",
      client_secret: "client-secret",
      redirect_uris: ["http://localhost:5000/"],
      post_logout_redirect_uris: ["http://localhost:5000/"],
      token_endpoint_auth_method: "none",
    },
  ],
  clientBasedCORS: () => true,
  ttl: {
    AccessToken: 60, // seconds
  },
});

provider.listen(port, () => {
  console.log(
    `mock-provider listening on port ${port}, check http://localhost:${port}/.well-known/openid-configuration`
  );
});
