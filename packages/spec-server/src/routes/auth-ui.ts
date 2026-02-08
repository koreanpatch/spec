import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { createUser, authenticateUser } from "../services/auth.js";
import { findSessionByRequestUri, markSessionAuthorized } from "../db/queries/sessions.js";

const AUTH_STYLES = `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    max-width: 400px;
    margin: 50px auto;
    padding: 20px;
    background: #f9f9f9;
  }
  h1 { margin-bottom: 20px; font-size: 24px; }
  form {
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  input {
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }
  button {
    width: 100%;
    padding: 14px;
    background: #0070f3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
  }
  button:hover { background: #0051cc; }
  .btn-deny {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ccc;
  }
  .btn-deny:hover { background: #e8e8e8; }
  .error {
    color: #e00;
    background: #fee;
    padding: 12px;
    border-radius: 4px;
    margin: 15px 0;
    border: 1px solid #fcc;
  }
  .app-info {
    background: #f0f8ff;
    padding: 20px;
    border-radius: 8px;
    margin: 20px 0;
    border: 1px solid #d0e8ff;
  }
  .app-info h2 { margin-bottom: 10px; font-size: 18px; }
  .app-info ul { margin-left: 20px; margin-top: 10px; }
  .app-info li { margin: 8px 0; }
  a { color: #0070f3; text-decoration: none; }
  a:hover { text-decoration: underline; }
  p { margin: 15px 0; text-align: center; color: #666; }
</style>
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setUserCookie(c: Parameters<typeof setCookie>[0], userId: string) {
  setCookie(c, "spec_user", userId, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "Lax",
    maxAge: 86400,
    path: "/",
  });
}

export function authUiRoutes() {
  const router = new Hono();

  router.get("/signup", async (c) => {
    const requestUri = c.req.query("request_uri") ?? "";

    return c.html(`<!DOCTYPE html>
<html>
<head><title>Sign Up - SPEC</title>${AUTH_STYLES}</head>
<body>
  <h1>Create SPEC Account</h1>
  <form method="POST" action="/signup">
    <input type="email" name="email" placeholder="Email" required />
    <input type="password" name="password" placeholder="Password (min 8 chars)" required minlength="8" />
    <input type="hidden" name="request_uri" value="${escapeHtml(requestUri)}" />
    <button type="submit">Sign Up</button>
  </form>
  <p>Already have an account? <a href="/login${requestUri ? `?request_uri=${encodeURIComponent(requestUri)}` : ""}">Log in</a></p>
</body>
</html>`);
  });

  router.post("/signup", async (c) => {
    const body = await c.req.parseBody();
    const email = body["email"] as string;
    const password = body["password"] as string;
    const requestUri = body["request_uri"] as string;

    try {
      const user = await createUser({ email, password });

      setUserCookie(c, user.id);

      if (requestUri) {
        return c.redirect(`/consent?request_uri=${encodeURIComponent(requestUri)}`);
      }

      return c.redirect("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error";
      return c.html(`<!DOCTYPE html>
<html>
<head><title>Signup Error - SPEC</title>${AUTH_STYLES}</head>
<body>
  <div class="error">${escapeHtml(message)}</div>
  <p><a href="/signup${requestUri ? `?request_uri=${encodeURIComponent(requestUri)}` : ""}">Try again</a></p>
</body>
</html>`, 400);
    }
  });

  router.get("/login", async (c) => {
    const requestUri = c.req.query("request_uri") ?? "";

    return c.html(`<!DOCTYPE html>
<html>
<head><title>Log In - SPEC</title>${AUTH_STYLES}</head>
<body>
  <h1>Log In to SPEC</h1>
  <form method="POST" action="/login">
    <input type="email" name="email" placeholder="Email" required />
    <input type="password" name="password" placeholder="Password" required />
    <input type="hidden" name="request_uri" value="${escapeHtml(requestUri)}" />
    <button type="submit">Log In</button>
  </form>
  <p>Don't have an account? <a href="/signup${requestUri ? `?request_uri=${encodeURIComponent(requestUri)}` : ""}">Sign up</a></p>
</body>
</html>`);
  });

  router.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const email = body["email"] as string;
    const password = body["password"] as string;
    const requestUri = body["request_uri"] as string;

    try {
      const user = await authenticateUser(email, password);

      if (!user) {
        return c.html(`<!DOCTYPE html>
<html>
<head><title>Login Error - SPEC</title>${AUTH_STYLES}</head>
<body>
  <div class="error">Invalid email or password</div>
  <p><a href="/login${requestUri ? `?request_uri=${encodeURIComponent(requestUri)}` : ""}">Try again</a></p>
</body>
</html>`, 401);
      }

      setUserCookie(c, user.id);

      if (requestUri) {
        return c.redirect(`/consent?request_uri=${encodeURIComponent(requestUri)}`);
      }

      return c.redirect("/");
    } catch (error) {
      process.stderr.write(`Login error: ${error}\n`);
      const requestParam = requestUri ? `?request_uri=${encodeURIComponent(requestUri)}` : "";
      return c.html(`<!DOCTYPE html>
<html>
<head><title>Login Error - SPEC</title>${AUTH_STYLES}</head>
<body>
  <div class="error">Server error. Please try again.</div>
  <p><a href="/login${requestParam}">Try again</a></p>
</body>
</html>`, 500);
    }
  });

  router.get("/consent", async (c) => {
    const requestUri = c.req.query("request_uri");

    if (!requestUri) {
      return c.text("Missing request_uri", 400);
    }

    const userId = getCookie(c, "spec_user");
    if (!userId) {
      return c.redirect(`/login?request_uri=${encodeURIComponent(requestUri)}`);
    }

    const session = await findSessionByRequestUri(requestUri);

    if (!session) {
      return c.text("Invalid or expired request_uri", 400);
    }

    let appName = session.client_id;
    try {
      appName = new URL(session.client_id).hostname;
    } catch {
      // client_id is not a URL, use as-is
    }

    return c.html(`<!DOCTYPE html>
<html>
<head><title>Authorize App - SPEC</title>${AUTH_STYLES}</head>
<body>
  <h1>Authorize App</h1>
  <div class="app-info">
    <h2>${escapeHtml(appName)}</h2>
    <p>This app wants to:</p>
    <ul>
      <li>Access your SPEC identity</li>
      <li>Write learning events to your profile</li>
      <li>Read your ELO score</li>
    </ul>
  </div>
  <form method="POST" action="/consent">
    <input type="hidden" name="request_uri" value="${escapeHtml(requestUri)}" />
    <button type="submit" name="action" value="allow">Allow</button>
    <button type="submit" name="action" value="deny" class="btn-deny">Deny</button>
  </form>
</body>
</html>`);
  });

  router.post("/consent", async (c) => {
    const body = await c.req.parseBody();
    const requestUri = body["request_uri"] as string;
    const action = body["action"] as string;

    const userId = getCookie(c, "spec_user");
    if (!userId) {
      return c.redirect(`/login?request_uri=${encodeURIComponent(requestUri)}`);
    }

    const session = await findSessionByRequestUri(requestUri);
    if (!session) {
      return c.text("Invalid or expired request_uri", 400);
    }

    if (action === "deny") {
      const params = new URLSearchParams({ error: "access_denied" });
      if (session.state) {
        params.set("state", session.state);
      }
      return c.redirect(`${session.redirect_uri}?${params.toString()}`);
    }

    await markSessionAuthorized(session.id, userId);

    return c.redirect(`/oauth/authorize?request_uri=${encodeURIComponent(requestUri)}&client_id=${encodeURIComponent(session.client_id)}`);
  });

  return router;
}
