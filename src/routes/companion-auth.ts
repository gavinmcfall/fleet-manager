import { Hono } from "hono";
import type { HonoEnv } from "../lib/types";
import { createAuth } from "../lib/auth";
import { logEvent } from "../lib/logger";
import { escapeHtml } from "../lib/utils";

const companionAuth = new Hono<HonoEnv>();

/**
 * Serve a minimal HTML page (no framework dependencies — these routes are outside the SPA).
 */
function htmlPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — SC Bridge</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0f172a; color: #e2e8f0; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px;
            padding: 2rem; max-width: 420px; width: 100%; text-align: center; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1rem; }
    .user { background: #0f172a; border-radius: 8px; padding: 0.75rem 1rem;
            margin-bottom: 1.5rem; font-weight: 500; }
    .btn { display: inline-block; background: #3b82f6; color: #fff; border: none;
           padding: 0.625rem 1.5rem; border-radius: 8px; font-size: 0.875rem;
           font-weight: 500; cursor: pointer; text-decoration: none; }
    .btn:hover { background: #2563eb; }
    .logo { width: 48px; height: 48px; margin-bottom: 1rem; }
    .subtle { color: #64748b; font-size: 0.75rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * GET /companion/connect?port=PORT&state=STATE
 *
 * Entry point for the companion app OAuth flow.
 * If not logged in → redirect to login with return URL.
 * If logged in → show "Connect Companion App" page with user info and Connect button.
 */
companionAuth.get("/connect", async (c) => {
  const port = c.req.query("port");
  const state = c.req.query("state");

  if (!port || !state) {
    return htmlPage("Error", `
      <h1>Missing Parameters</h1>
      <p>The companion app did not provide the required connection parameters.</p>
      <p>Please try connecting again from the companion app.</p>
    `);
  }

  // Validate port is a number in valid range
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return htmlPage("Error", `
      <h1>Invalid Port</h1>
      <p>The companion app provided an invalid port number.</p>
    `);
  }

  // Validate state is hex (32 bytes = 64 chars)
  if (!/^[a-f0-9]{64}$/i.test(state)) {
    return htmlPage("Error", `
      <h1>Invalid State</h1>
      <p>The connection request contains an invalid state parameter.</p>
    `);
  }

  // Check if user is logged in via session cookie
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    // Redirect to login with return URL
    const returnUrl = `${c.env.BETTER_AUTH_URL}/companion/connect?port=${port}&state=${encodeURIComponent(state)}`;
    return c.redirect(`${c.env.BETTER_AUTH_URL}/login?redirect=${encodeURIComponent(returnUrl)}`);
  }

  // Verify user is active
  const record = await c.env.DB
    .prepare("SELECT status FROM user WHERE id = ?")
    .bind(session.user.id)
    .first<{ status: string }>();

  if (!record || record.status !== "active") {
    return htmlPage("Account Unavailable", `
      <h1>Account Unavailable</h1>
      <p>Your account is not currently active. Please contact support.</p>
    `);
  }

  const userName = escapeHtml(session.user.name || session.user.email || "User");

  return htmlPage("Connect Companion App", `
    <h1>Connect Companion App</h1>
    <p>The SC Bridge companion app is requesting access to your account.</p>
    <div class="user">${userName}</div>
    <form method="POST" action="${c.env.BETTER_AUTH_URL}/companion/authorize">
      <input type="hidden" name="port" value="${escapeHtml(port)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <button type="submit" class="btn">Connect</button>
    </form>
    <p class="subtle">This will create a session for the companion app. You can disconnect at any time.</p>
  `);
});

/**
 * POST /companion/authorize
 *
 * Requires authenticated session (user clicked "Connect" on the connect page).
 * Creates a new session in the D1 session table and redirects the companion app
 * callback with the session token.
 */
companionAuth.post("/authorize", async (c) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.redirect(`${c.env.BETTER_AUTH_URL}/login`);
  }

  // Verify user is active
  const record = await c.env.DB
    .prepare("SELECT status FROM user WHERE id = ?")
    .bind(session.user.id)
    .first<{ status: string }>();

  if (!record || record.status !== "active") {
    return htmlPage("Error", `
      <h1>Account Unavailable</h1>
      <p>Your account is not currently active.</p>
    `);
  }

  // Parse form body
  const formData = await c.req.parseBody();
  const port = String(formData.port || "");
  const state = String(formData.state || "");

  // Re-validate
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return htmlPage("Error", `
      <h1>Invalid Parameters</h1>
      <p>The connection request has expired or is invalid. Please try again from the companion app.</p>
    `);
  }

  if (!/^[a-f0-9]{64}$/i.test(state)) {
    return htmlPage("Error", `
      <h1>Invalid State</h1>
      <p>The connection request contains an invalid state parameter.</p>
    `);
  }

  // Generate a crypto-random session token
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  // Generate a session ID
  const idBytes = new Uint8Array(16);
  crypto.getRandomValues(idBytes);
  const sessionId = Array.from(idBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  // Create session row in Better Auth's session table
  // 30-day expiry for companion app sessions
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB
    .prepare(
      `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt, userAgent)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
    )
    .bind(sessionId, token, session.user.id, expiresAt, "SC Bridge Companion App")
    .run();

  logEvent("companion_auth_connected", {
    user_id: session.user.id,
    session_id: sessionId,
  });

  // Redirect to companion app's local callback
  const callbackUrl = `http://localhost:${portNum}/callback?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
  return c.redirect(callbackUrl);
});

/**
 * GET /companion/connected
 *
 * Static success page shown after the companion app captures the token.
 */
companionAuth.get("/connected", () => {
  return htmlPage("Connected", `
    <h1>Connected!</h1>
    <p>Your SC Bridge companion app is now connected to your account.</p>
    <p>You can close this tab.</p>
    <p class="subtle">If the companion app doesn't show as connected, try restarting it.</p>
  `);
});

export function companionAuthRoutes() {
  return companionAuth;
}
