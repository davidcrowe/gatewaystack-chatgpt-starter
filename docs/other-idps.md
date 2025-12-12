# Using Other Identity Providers

This MCP server works with **any OIDC-compliant IdP**.

---

## Supported providers

* Auth0
* Okta
* Azure AD / Entra ID
* Google Identity
* Keycloak
* Ping

---

## Required properties

Your IdP must provide:

* JWT access tokens (JWS)
* `iss` claim
* `aud` claim
* RS256 signing
* JWKS endpoint

---

## What to configure

Set these env vars:

```
OAUTH_ISSUER=https://issuer.example.com
OAUTH_AUDIENCE=https://your-api
JWKS_URI=https://issuer.example.com/.well-known/jwks.json
```

Some providers require explicit `JWKS_URI`.

---

## Scopes and permissions

Scopes should:

* Be included in the access token
* Match tool names or permissions

Example:

```
inner.reports.read
inner.reports.write
```

---

## Subject mapping

Edit:

```
subjectToUid(sub, email?)
```

to map IdP users → internal users.

---

## Multi-IdP setups

You can:

* Run multiple deployments
* Or accept multiple issuers (advanced)

The starter defaults to **one issuer** for safety.

---

## Security note

Do **not** disable issuer verification in production unless you fully control the token source.
