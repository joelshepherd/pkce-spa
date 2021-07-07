const { Provider } = require("oidc-provider");

const port = 4444;

const config = {
  clients: [
    {
      client_id: "client-id",
      client_secret: "client-secret",
      redirect_uris: ["http://localhost:5000/test/"],
      post_logout_redirect_uris: ["http://localhost:5000/"],
      token_endpoint_auth_method: "none",
    },
  ],
  clientBasedCORS: () => true,
};

const provider = new Provider(`http://localhost:${port}`, config);

provider.listen(port, () => {
  console.log(
    `mock-provider listening on port ${port}, check http://localhost:${port}/.well-known/openid-configuration`
  );
});
