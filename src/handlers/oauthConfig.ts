// functions/src/handlers/oauthConfig.ts

// Canonical place to read OAuth-related env for the gateway / well-known endpoints

export const OAUTH_ISSUER = (process.env.OAUTH_ISSUER ??
  "https://dev-e2r87v477lvku60t.us.auth0.com/").replace(/\/+$/, "");

export const OAUTH_AUDIENCE = process.env.OAUTH_AUDIENCE || undefined; // Auth0 API Identifier when set
export const OAUTH_SCOPES = (process.env.OAUTH_SCOPES ?? "openid email profile").trim();

export const JWKS_URI_FALLBACK =
  process.env.JWKS_URI ?? `${OAUTH_ISSUER}/.well-known/jwks.json`;

const RAW_OIDC_DISCOVERY =
  process.env.OIDC_DISCOVERY ?? `${OAUTH_ISSUER}/.well-known/openid-configuration`;

export const OIDC_DISCOVERY = RAW_OIDC_DISCOVERY.startsWith("http")
  ? RAW_OIDC_DISCOVERY
  : `${OAUTH_ISSUER}/${RAW_OIDC_DISCOVERY.replace(/^\/+/, "")}`;
