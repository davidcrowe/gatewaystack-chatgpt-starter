# Auth0 Setup Guide

This guide shows how to configure **Auth0** as the OAuth provider for this MCP server.

---

## 1. Create an API

Auth0 Dashboard → APIs → Create API

* Identifier: `https://your-api`
* Signing algorithm: RS256

Save the **Identifier** — this is your `OAUTH_AUDIENCE`.

---

## 2. Create an Application

Create a **Regular Web Application**:

* Allowed Callback URLs:

  * `https://chat.openai.com/*`
* Allowed Web Origins:

  * `https://chat.openai.com`

---

## 3. Token configuration

Ensure access tokens are:

* **JWT (JWS)**
* Not encrypted (no JWE)

If you see `ACCESS_TOKEN_IS_ENCRYPTED_JWE`, disable encryption.

---

## 4. Scopes

Define scopes matching your tools, e.g.:

```
starter.whoami
starter.echo
starter.notes
```

Grant them to users or roles.

---

## 5. Environment variables

```
OAUTH_ISSUER=https://YOUR_TENANT.us.auth0.com
OAUTH_AUDIENCE=https://your-api
```

JWKS is auto-discovered.

---

## 6. Test

Call:

```
GET /debug-token
```

Verify:

* `iss` matches `OAUTH_ISSUER`
* `aud` matches `OAUTH_AUDIENCE`

---

## Production tips

* Use Auth0 Actions to inject roles/permissions
* Use stable `sub` mapping for internal user IDs

See `OTHER_IDPS.md` for non-Auth0 providers.
