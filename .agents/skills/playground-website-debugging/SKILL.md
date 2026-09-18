---
name: playground-website-debugging
description: Debug the WordPress Playground website by running the dev server from source and interacting with it via Playwright MCP. Use when investigating UI bugs, testing website features, checking for JavaScript errors, debugging hanging requests, or verifying WordPress behavior in the browser-based Playground.
---

# Playground Dev Server Debugging with Playwright MCP

Debug the WordPress Playground website by running the dev server from source and interacting with it via Playwright MCP.

**Requires:** Node.js, Playwright MCP server

## Quick Start

```bash
# Ensure the correct Node.js version is active as per .nvmrc
nvm use

# Kill any leftover dev server from a previous run
lsof -ti:5400 -ti:5263 -ti:6400 | xargs kill 2>/dev/null; sleep 1

# Start dev server in background
npm run dev > /tmp/playground-dev.log 2>&1 &

# Wait for server to respond (up to ~120s for first build)
until curl -s -o /dev/null http://127.0.0.1:5400/website-server/ 2>/dev/null; do
  sleep 2
done
echo "Ready!"
```

Then use Playwright MCP to interact:

```
browser_navigate → http://127.0.0.1:5400/website-server/
browser_snapshot → inspect the page structure
browser_take_screenshot → visual state
```

## Architecture: The Iframe Boundary

The Playground website has a three-layer structure that's critical to understand:

```
┌───────────────────────────────────────────────────┐
│ Parent page (Playground chrome / React app)       │
│ ┌───────────────────────────────────────────────┐ │
│ │ URL bar │ Save │ Settings │ Site Mgr          │ │
│ ├───────────────────────────────────────────────┤ │
│ │                                               │ │
│ │  <iframe class="playground-viewport">         │ │
│ │    Loads remote.html                          │ │
│ │    (Service Worker, Web Worker, PHP runtime)  │ │
│ │   ┌─────────────────────────────────────────┐ │ │
│ │   │  <iframe id="wp">                       │ │ │
│ │   │    WordPress runs here                  │ │ │
│ │   │    (wp-admin, front-end, editor, etc.)  │ │ │
│ │   └─────────────────────────────────────────┘ │ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Parent page** contains: URL bar, Save button, Saved Playgrounds, Site Manager, Settings gear.

**Outer iframe** (`playground-viewport`) loads `remote.html`, which registers the Service Worker, spawns a Web Worker for the PHP runtime, and exposes the Playground API via Comlink.

**Inner iframe** (`#wp`, nested inside the outer iframe) contains the actual WordPress site — dashboard, posts, pages, plugins, themes, block editor, front-end.

Playwright's `browser_snapshot` traverses both iframes automatically, so you'll see all three layers in one snapshot. When clicking elements inside WordPress, Playwright handles the iframe targeting.

**Important:** WordPress admin CSS positions sidebar **submenu items off-screen** (e.g. `top: -12387px`) until their parent menu is hovered. These elements appear in `browser_snapshot` but `browser_click` will fail with "element is outside of the viewport." Two workarounds:

1. **Hover parent first** (preferred — mimics real user behavior):

```js
async (page) => {
	const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
	await frame.locator('#menu-tools').hover();
	await frame.locator('a[href="site-health.php"]').click();
};
```

2. **JS click** (bypasses Playwright's visibility checks):

```js
async (page) => {
	const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
	await frame.locator('a[href="site-health.php"]').evaluate((el) => el.click());
};
```

## PHP-WASM Request Pipeline

Understanding how HTTP requests flow through Playground is critical for debugging performance and hanging issues:

```
Browser request (navigation, AJAX, etc.)
    ↓
Service Worker intercepts fetch event
    ↓
broadcastMessageExpectReply() → broadcasts to all window clients
    ↓
remote.html window receives message (filtered by scope) → proxies to Web Worker
    ↓
PHPProcessManager.acquirePHPInstance() → Semaphore (max 2 instances, 30s timeout)
    ↓
PHP-WASM executes the PHP script
    ↓
If PHP calls wp_remote_get(): Wp_Http_Fetch → post_message_to_js() → JS fetch()
    ↓
fetch() for loopback URLs → goes BACK through Service Worker → needs another PHP instance!
```

**Timeout mismatch:** The Service Worker times out waiting for a response after **25s** (`DEFAULT_RESPONSE_TIMEOUT`), but the PHP semaphore waits up to **30s**. If PHP is stuck, the Service Worker returns `ERR_FAILED` while the process manager is still waiting — useful to know when diagnosing hanging requests.

## Dev Server Details

| Setting      | Value                                                 |
| ------------ | ----------------------------------------------------- |
| Command      | `npm run dev` (runs `nx dev playground-website`)      |
| Main URL     | `http://127.0.0.1:5400/website-server/`               |
| Ready signal | HTTP 200 from `http://127.0.0.1:5400/website-server/` |
| Auto-login   | Yes (logged in as `admin` by default)                 |
| HMR          | Enabled — code changes hot-reload                     |

**Note:** `npm run dev` also starts a PHP CORS proxy (`php -S 127.0.0.1:5263`). If system PHP isn't installed, that subprocess fails — the website still loads but features relying on the CORS proxy (e.g., fetching external resources) won't work.

## Workflow

### 1. Start the Dev Server

```bash
npm run dev
# Wait for "Local:   http://127.0.0.1:5400/website-server/" in output
```

### 2. Navigate and Inspect

```
browser_navigate → http://127.0.0.1:5400/website-server/
browser_snapshot → see full page tree including iframe content
browser_take_screenshot → capture visual state
```

### 3. Navigate Within WordPress

To visit WordPress pages (e.g., wp-admin), use the Playground URL bar:

```
browser_click → click the URL bar textbox (labeled "URL to visit in the WordPress site")
browser_type → type "/wp-admin/"
browser_press_key → press "Enter"
browser_snapshot → verify the page loaded
```

### 4. Debug Common Scenarios

**Check for JavaScript errors:**

```
browser_console_messages (level: "error") → see JS errors and warnings
```

**Check for stuck/failed network requests:**

```
browser_network_requests (includeStatic: false) → see all XHR/fetch requests and their status
```

Requests showing no status code are still **pending**. Requests with `[FAILED] net::ERR_FAILED` typically indicate a service worker timeout (25s) — a sign of PHP-WASM deadlock (see "PHP-WASM Request Pipeline" above).

**Time a navigation:**

```js
// Use browser_run_code to measure how long a navigation takes
async (page) => {
	const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
	const start = Date.now();
	await frame.locator('a[href="site-health.php"]').evaluate((el) => el.click());
	await frame.getByRole('heading', { name: 'Site Health', level: 1 }).waitFor({ timeout: 60000 });
	return `Navigation took ${Date.now() - start}ms`;
};
```

**Inspect the block editor:**

```
browser_click → URL bar
browser_type → /wp-admin/post-new.php
browser_press_key → Enter
browser_snapshot → see block editor structure inside iframe
```

**Test plugin/theme UI:**

```
browser_click → URL bar
browser_type → /wp-admin/plugins.php
browser_press_key → Enter
browser_snapshot → verify plugin list
```

**Screenshot a specific state:**

```
browser_take_screenshot → capture current visual state for comparison
```

### 5. Stop the Server

Kill the `npm run dev` process (Ctrl+C in the terminal, or `lsof -ti:5400 | xargs kill`).
