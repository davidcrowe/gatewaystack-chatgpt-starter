# Troubleshooting

Common issues when wiring ChatGPT, OAuth, and MCP servers.

---

## Repeated OAuth prompts

**Cause:** ChatGPT cannot validate OAuth discovery

Check:

* `/.well-known/oauth-protected-resource`
* `WWW-Authenticate` headers

---

## 401 invalid_token

**Cause:** JWT verification failed

Check:

* `iss` exactly matches `OAUTH_ISSUER` (no trailing slash mismatch)
* `aud` matches `OAUTH_AUDIENCE`
* JWKS reachable

Enable debug logging of token `iss/aud`.

---

## ACCESS_TOKEN_IS_ENCRYPTED_JWE

**Cause:** IdP returns encrypted tokens

Fix:

* Disable access token encryption
* Use signed JWTs only

---

## Tools list but calls fail

**Cause:** Scope mismatch

Check:

* Tool → required scopes
* Scopes granted to the user
* Scope format (`space`-delimited vs array)

---

## 500 errors from MCP

**Cause:** Backend tool failure bubbling up

Fix:

* Catch backend errors
* Return structured MCP errors

---

## Revision not updating

**Cause:** CI/CD not creating a new deploy

Check:

* Cloud Build deploy step exists
* Cloud Run revision changes
* `K_REVISION` logs

---

## Still stuck?

Log:

* request path
* revision
* GIT_SHA
* token shape (JWT/JWE)

These four signals usually pinpoint the issue.
