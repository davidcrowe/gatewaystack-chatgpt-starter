#!/usr/bin/env node

// scripts/setup-auth0.mjs
//
// Programmatic Auth0 setup for GatewayStack.
// Creates the API, application, scopes, and writes .env — all in one shot.
//
// Prerequisites:
//   npm install -g auth0-cli   (or: brew install auth0/auth0-cli/auth0)
//   auth0 login                (authenticate once)
//
// Usage:
//   node scripts/setup-auth0.mjs
//   node scripts/setup-auth0.mjs --tenant your-tenant.us.auth0.com
//   node scripts/setup-auth0.mjs --api-name "My MCP API" --app-name "My MCP App"
//
// What it does:
//   1. Detects your Auth0 tenant (or uses --tenant)
//   2. Creates an API with RS256 signing and the starter's scopes
//   3. Creates a Regular Web Application with MCP-compatible callback URLs
//   4. Authorizes the application for the API with all scopes
//   5. Writes OAUTH_ISSUER and OAUTH_AUDIENCE to .env
//
// Safe to re-run: checks for existing resources before creating.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCOPES = [
  "starter.whoami",
  "starter.echo",
  "starter.notes",
  "starter.crm",
];

const DEFAULT_API_NAME = "GatewayStack MCP API";
const DEFAULT_API_IDENTIFIER = "https://gatewaystack-mcp";
const DEFAULT_APP_NAME = "GatewayStack MCP Server";

// MCP clients that need callback URLs
const CALLBACK_URLS = [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "http://localhost:3000/callback",
];

const WEB_ORIGINS = [
  "https://chat.openai.com",
  "https://chatgpt.com",
  "https://claude.ai",
  "http://localhost:3000",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) opts.tenant = args[++i];
    else if (args[i] === "--api-name" && args[i + 1]) opts.apiName = args[++i];
    else if (args[i] === "--app-name" && args[i + 1]) opts.appName = args[++i];
    else if (args[i] === "--api-id" && args[i + 1]) opts.apiIdentifier = args[++i];
    else if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: node scripts/setup-auth0.mjs [options]

Options:
  --tenant <domain>    Auth0 tenant domain (auto-detected if omitted)
  --api-name <name>    API display name (default: "${DEFAULT_API_NAME}")
  --api-id <url>       API identifier/audience (default: "${DEFAULT_API_IDENTIFIER}")
  --app-name <name>    Application display name (default: "${DEFAULT_APP_NAME}")
  --dry-run            Show what would be created without making changes
  --help               Show this help
`);
      process.exit(0);
    }
  }
  return opts;
}

function run(cmd, { json = false, silent = false } = {}) {
  try {
    const out = execSync(cmd, {
      encoding: "utf-8",
      stdio: silent ? ["pipe", "pipe", "pipe"] : ["pipe", "pipe", "inherit"],
    }).trim();
    return json && out ? JSON.parse(out) : out;
  } catch (e) {
    if (silent) return null;
    throw e;
  }
}

function checkAuth0Cli() {
  try {
    run("auth0 --version", { silent: true });
    return true;
  } catch {
    return false;
  }
}

function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const apiName = opts.apiName || DEFAULT_API_NAME;
  const apiIdentifier = opts.apiIdentifier || DEFAULT_API_IDENTIFIER;
  const appName = opts.appName || DEFAULT_APP_NAME;

  console.log();
  console.log("  GatewayStack — Auth0 Setup");
  console.log("  ─────────────────────────────");
  console.log();

  // 1. Check auth0 CLI is installed and authenticated
  if (!checkAuth0Cli()) {
    console.error("  Error: auth0 CLI not found.\n");
    console.error("  Install it:");
    console.error("    brew install auth0/auth0-cli/auth0");
    console.error("    # or: npm install -g auth0-cli");
    console.error("");
    console.error("  Then authenticate:");
    console.error("    auth0 login");
    console.error("");
    process.exit(1);
  }
  log("✓", "auth0 CLI found");

  // 2. Detect tenant
  let tenant = opts.tenant;
  if (!tenant) {
    const tenants = run("auth0 tenants list --json", { json: true, silent: true });
    if (!tenants || tenants.length === 0) {
      console.error("\n  Error: No Auth0 tenants found. Run: auth0 login\n");
      process.exit(1);
    }
    // Use the default tenant (first one, or the one marked default)
    const defaultTenant = tenants.find((t) => t.default) || tenants[0];
    tenant = defaultTenant.name || defaultTenant.domain;
  }

  // Normalize tenant to domain format
  if (!tenant.includes(".")) {
    tenant = `${tenant}.us.auth0.com`;
  }
  const issuer = `https://${tenant}/`;

  log("✓", `tenant: ${tenant}`);

  if (opts.dryRun) {
    console.log();
    log("→", `Would create API: "${apiName}" (${apiIdentifier})`);
    log("→", `Would create App: "${appName}"`);
    log("→", `Would add scopes: ${SCOPES.join(", ")}`);
    log("→", `Would write to .env: OAUTH_ISSUER=${issuer}`);
    log("→", `Would write to .env: OAUTH_AUDIENCE=${apiIdentifier}`);
    console.log();
    process.exit(0);
  }

  // 3. Create API (resource server)
  log("…", `creating API "${apiName}"…`);

  let api;
  try {
    // Check if API already exists
    const apis = run("auth0 apis list --json", { json: true, silent: true }) || [];
    api = apis.find((a) => a.identifier === apiIdentifier);

    if (api) {
      log("✓", `API already exists: ${apiIdentifier} (id: ${api.id})`);
    } else {
      const scopeFlags = SCOPES.map((s) => `--scopes "${s}"`).join(" ");
      api = run(
        `auth0 apis create --name "${apiName}" --identifier "${apiIdentifier}" --signing-alg RS256 ${scopeFlags} --json`,
        { json: true }
      );
      log("✓", `API created: ${apiIdentifier} (id: ${api.id})`);
    }
  } catch (e) {
    console.error("\n  Failed to create API. Error:", e.message);
    console.error("  You may need to run: auth0 login\n");
    process.exit(1);
  }

  // 4. Ensure scopes exist on the API
  log("…", "ensuring scopes are configured…");

  try {
    // auth0 apis scopes list doesn't exist in all CLI versions,
    // so we update the API with the scopes to ensure they're set
    const scopeFlags = SCOPES.map((s) => `--scopes "${s}"`).join(" ");
    run(`auth0 apis update ${api.id} ${scopeFlags}`, { silent: true });
    log("✓", `scopes configured: ${SCOPES.join(", ")}`);
  } catch {
    // Non-fatal — scopes might already be set from creation
    log("~", "scopes may already be configured (update skipped)");
  }

  // 5. Create Application (Regular Web App)
  log("…", `creating application "${appName}"…`);

  let app;
  try {
    const apps = run("auth0 apps list --json", { json: true, silent: true }) || [];
    app = apps.find((a) => a.name === appName);

    if (app) {
      log("✓", `application already exists: ${appName} (client_id: ${app.client_id})`);
    } else {
      app = run(
        `auth0 apps create --name "${appName}" --type regular --callbacks "${CALLBACK_URLS.join(",")}" --origins "${WEB_ORIGINS.join(",")}" --json`,
        { json: true }
      );
      log("✓", `application created: ${appName} (client_id: ${app.client_id})`);
    }
  } catch (e) {
    console.error("\n  Failed to create application. Error:", e.message);
    process.exit(1);
  }

  // 6. Authorize application for the API (grant scopes)
  log("…", "authorizing application for API…");

  try {
    // Use the Management API to create a client grant
    const grants = run("auth0 api-grants list --json", { json: true, silent: true }) || [];
    const existingGrant = grants.find(
      (g) => g.client_id === app.client_id && g.audience === apiIdentifier
    );

    if (existingGrant) {
      log("✓", "client grant already exists");
    } else {
      run(
        `auth0 api-grants create --client-id "${app.client_id}" --audience "${apiIdentifier}" --scopes "${SCOPES.join(",")}"`,
        { silent: true }
      );
      log("✓", "client grant created with all scopes");
    }
  } catch {
    log("~", "client grant may need manual configuration (see docs)");
  }

  // 7. Enable RBAC and permissions in access token
  log("…", "enabling RBAC settings…");

  try {
    run(
      `auth0 apis update ${api.id} --token-lifetime 86400 --allow-offline-access`,
      { silent: true }
    );
    log("✓", "API token settings updated");
  } catch {
    log("~", "API settings update skipped (may need manual RBAC toggle)");
  }

  // 8. Write .env
  log("…", "writing .env…");

  const envPath = resolve(ROOT, ".env");
  let envContent = "";

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf-8");
  } else if (existsSync(resolve(ROOT, ".env.example"))) {
    envContent = readFileSync(resolve(ROOT, ".env.example"), "utf-8");
  }

  // Replace or append OAuth vars
  function setEnvVar(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content + `\n${key}=${value}`;
  }

  envContent = setEnvVar(envContent, "OAUTH_ISSUER", issuer);
  envContent = setEnvVar(envContent, "OAUTH_AUDIENCE", apiIdentifier);

  writeFileSync(envPath, envContent);
  log("✓", `.env updated: OAUTH_ISSUER=${issuer}`);
  log("✓", `.env updated: OAUTH_AUDIENCE=${apiIdentifier}`);

  // 9. Summary
  console.log();
  console.log("  ─────────────────────────────");
  console.log("  Setup complete.");
  console.log();
  console.log("  Your Auth0 configuration:");
  console.log(`    Tenant:     ${tenant}`);
  console.log(`    API:        ${apiIdentifier} (${apiName})`);
  console.log(`    App:        ${appName} (${app.client_id})`);
  console.log(`    Scopes:     ${SCOPES.join(", ")}`);
  console.log();
  console.log("  Next steps:");
  console.log("    1. npm run dev");
  console.log("    2. Expose with ngrok: ngrok http 3000");
  console.log("    3. Add to ChatGPT: Settings → Apps → Add MCP server");
  console.log("    4. Test: ask ChatGPT to run the whoami tool");
  console.log();
  console.log("  To verify locally:");
  console.log("    curl http://localhost:3000/.well-known/oauth-protected-resource");
  console.log();

  // 10. Optional: enable RBAC reminder
  console.log("  ⚠  Manual step required:");
  console.log(`    Auth0 Dashboard → APIs → ${apiName} → Settings`);
  console.log('    Enable "RBAC" and "Add Permissions in the Access Token"');
  console.log("    (The CLI cannot toggle these settings yet)");
  console.log();
}

main().catch((e) => {
  console.error("\n  Unexpected error:", e.message);
  process.exit(1);
});
