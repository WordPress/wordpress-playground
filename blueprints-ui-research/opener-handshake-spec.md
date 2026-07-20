# Opener Handshake — passing a Blueprint + local bytes to playground.wordpress.net via postMessage

Status: draft v1 · Author: Blueprints UI research (design 7 "Site Card") · 2026-07-19

## Why

Blueprint builders live on other origins (the Site Card editor, Studio, Telex, third-party
tools). They can embed Playground via `@wp-playground/client` today, but they cannot hand a
user off to a real `playground.wordpress.net` tab together with **local bytes** (uploaded
images, zips, written files): the URL fragment carries only text and dies at megabyte scale.

`window.open` + `postMessage` closes the gap: structured clone moves `ArrayBuffer`s between
origins for free, and Playground's sandbox is already the security boundary for arbitrary
blueprints (the `#{json}` fragment executes `runPHP` today; this adds no new privilege).

## Terminology

- **Opener** — the page on any origin that calls `window.open()`. Keeps the window handle.
- **Receiver** — the Playground website tab, opened with the activation param.

## Activation

The receiver only listens when opened as:

```
https://playground.wordpress.net/?blueprint-source=opener
```

Without the param, no listener is installed — zero change to the site's message surface.
While waiting, the receiver shows its normal loading chrome with a caption like
"Waiting for the opener to send a Blueprint…". It keeps listening indefinitely; after ~30 s
it may add a hint ("Did the opener close?"). Other query params (`php`, `wp`, `language`…)
keep their meaning and act as defaults the payload's blueprint can override.

## Message protocol

Every message is an object with `type` (string) and `protocolVersion: 1`. Unknown fields
must be ignored; unknown `type`s must be ignored (forward compatibility).

### receiver → opener

| type | payload | when |
|---|---|---|
| `playground-blueprint:ready` | `{}` | On listener install, posted to `window.opener` with targetOrigin `'*'` (it carries nothing sensitive). Re-sent in reply to `hello`. |
| `playground-blueprint:accepted` | `{}` | Payload passed validation; boot is starting. |
| `playground-blueprint:rejected` | `{ reason: string }` | Validation failed, or a second `run` arrived (`reason: "already-running"`). |
| `playground-blueprint:progress` | `{ value: number, caption?: string }` | Optional boot progress, 0–100. |
| `playground-blueprint:booted` | `{ landingPage: string }` | Site is up, files applied. |
| `playground-blueprint:error` | `{ message: string }` | Boot or file application failed. |

After `accepted`, all messages target the pinned opener origin (see Security). If the opener
origin is the literal string `"null"` (a `file://` opener), fall back to `'*'`.

### opener → receiver

| type | payload | when |
|---|---|---|
| `playground-blueprint:hello` | `{}` | Optional probe; receiver replies `ready` if still waiting. |
| `playground-blueprint:run` | see below | The one-shot payload. Only the first valid `run` is honored. |

### The `run` payload

```ts
{
  type: 'playground-blueprint:run',
  protocolVersion: 1,
  blueprint: object,          // a standard Blueprint JSON object (v1 schema today)
  files?: Array<{
    name: string,             // file name, e.g. "hero.jpg"
    bytes: ArrayBuffer,       // structured clone carries this natively
    mimeType?: string,
    destination: 'vfs' | 'media-library',
    path?: string             // required when destination === 'vfs' (absolute, e.g. /wordpress/wp-content/foo.css)
  }>
}
```

- `blueprint` boots through the website's normal Blueprint execution path.
- `files` are applied **after boot**, in order:
  - `vfs` → write `bytes` to `path`, creating parent directories.
  - `media-library` → import as a real attachment (sideload: write to a temp path, then
    `wp_insert_attachment` + `wp_generate_attachment_metadata` so thumbnails and the Media
    Library grid work).
- A blueprint may also carry binary `literal` resources directly (structured clone permits
  typed arrays inside the object); `files` is the convenience lane and the only way to
  target the media library.

### Sequence

```
opener                                   receiver (?blueprint-source=opener)
  | window.open(url) ------------------->  |
  |                                        |  install listener, state = waiting
  |  <----------- playground-blueprint:ready (to window.opener, '*')
  | postMessage(run, '*') --------------->  |
  |                                        |  validate; pin event.origin; state = booting
  |  <----------- playground-blueprint:accepted
  |  <----------- playground-blueprint:progress (0..100) ...
  |                                        |  boot blueprint; apply files
  |  <----------- playground-blueprint:booted { landingPage }
```

State machine: `waiting → booting → booted | error`. A `run` in any state other than
`waiting` gets `rejected { reason: "already-running" }`.

## Security & limits

- **Gate**: the listener exists only under `?blueprint-source=opener`.
- **Source check**: accept `run` only when `event.source === window.opener`.
- **Origin pinning**: record `event.origin` from the accepted `run`; send every subsequent
  message to that origin only (`'*'` fallback for `"null"`).
- **No allowlist** by design — this is a public embedding API; the WASM sandbox is the
  security boundary, identical to fragment blueprints. Document this explicitly.
- **Validation**: `blueprint` must be a plain object; `files` capped (suggested: ≤ 200
  entries, ≤ 512 MB total, each `bytes` an ArrayBuffer); `vfs` paths must be absolute and
  must not contain `..` segments. Malformed → `rejected`, friendly error state, no crash.
- **Opener caveat** (document for builders): keep the `window.open` handle; do not sever
  the relationship (`noopener`) or `window.opener` is null on the receiver and the ready
  ping has nowhere to go.

## Future (out of scope for v1)

- A `MessageChannel` port inside `run` for a persistent API channel (post-boot writeFile,
  navigation, capture) — would let builders keep driving the opened tab.
- Blueprint v2 bundle objects (blueprint + files as one zip) over the same channel.
- `playground-blueprint:ready` advertising capabilities/protocol versions.

## Reference opener (builder side)

```js
function runInPlayground(blueprint, files) {
  const tab = window.open('https://playground.wordpress.net/?blueprint-source=opener');
  const onMessage = (e) => {
    if (e.source !== tab || !e.data || e.data.protocolVersion !== 1) return;
    if (e.data.type === 'playground-blueprint:ready') {
      tab.postMessage({
        type: 'playground-blueprint:run',
        protocolVersion: 1,
        blueprint,
        files, // [{ name, bytes, destination, path?, mimeType? }]
      }, '*');
    }
    if (e.data.type === 'playground-blueprint:booted') window.removeEventListener('message', onMessage);
    if (e.data.type === 'playground-blueprint:rejected' || e.data.type === 'playground-blueprint:error') {
      window.removeEventListener('message', onMessage);
      // surface e.data.reason || e.data.message
    }
  };
  window.addEventListener('message', onMessage);
}
```
