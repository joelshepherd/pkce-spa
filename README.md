# pkce-spa

An opinionated authentication session manager for OpenID Connect using PKCE.

## Features

- Automatic token refresh
- Cross-tab session syncronisation
- Exposes `access_token` as an event listener

## Install

```ts
import { Session } from "pkce-spa";

const session = new Session({ ...config });

session.onChange((accessToken) => {
  // Start the redirect flow if there isn't an active session
  if (accessToken === null) session.login();
});
```

## OpenID Connect provider settings

- Must have `authorization_code` and `refresh_token` grant types enabled
- Must have token endpoint authentication method set to `none`
- Must have refresh token rotation turned on
