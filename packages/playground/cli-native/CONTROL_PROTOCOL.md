# Native CLI control protocol

The private `@wp-playground/cli-native` package controls a local
`wp-playground-native` child over authenticated loopback HTTP. The protocol is
an implementation boundary, not a remote API: every URL in the handshake must
use loopback HTTP and every request requires the per-process bearer token.

## Version 2 endpoints

- `POST /rpc` returns one buffered JSON response.
- `POST /rpc/stream` returns an NDJSON response for `requestStreamed` or
  one-shot PHP `cli` execution.
- `POST /rpc/cancel` cancels one active streamed request.
- `GET /events` exposes supported lifecycle and worker events as SSE.

All request envelopes contain `protocolVersion: 2` and a numeric `id`.
Unknown versions, methods, fields, duplicate active IDs, and malformed values
are rejected. Authorization is checked before allocating the request body.

## Buffered values

Binary values always use a tagged object:

```json
{ "encoding": "base64", "data": "AAEC/w==" }
```

Request headers cross the wire as an ordered array of pairs:

```json
[
	{ "name": "accept", "value": "text/html" },
	{ "name": "cookie", "value": "first=1" },
	{ "name": "cookie", "value": "second=2" }
]
```

The pair array preserves duplicate values and arrival order. Public response
objects normalize names to lowercase and group the values as
`Record<string, string[]>` without reordering each value array.

A buffered `request` result contains `httpStatusCode`, ordered `headers`,
tagged `body` and `stderr` values, and the real PHP `exitCode`. A `run` result
uses the same metadata with tagged `stdout` and `stderr` values. Static-file
requests report exit code zero and empty stderr.

## Stream request and frames

The stream request body is:

```json
{
	"protocolVersion": 2,
	"id": 41,
	"method": "requestStreamed",
	"params": { "path": "/", "method": "GET", "headers": [] }
}
```

The response is a newline-delimited sequence, not one JSON array. Normally it
starts with exactly one `headers` frame, continues with zero or more output
frames, and ends with exactly one `complete` or `error` frame:

```json
{"protocolVersion":2,"id":41,"type":"headers","httpStatusCode":200,"headers":[]}
{"protocolVersion":2,"id":41,"type":"stdout","sequence":0,"data":{"encoding":"base64","data":"SGVsbG8="}}
{"protocolVersion":2,"id":41,"type":"stderr","sequence":1,"data":{"encoding":"base64","data":"d2FybmluZw=="}}
{"protocolVersion":2,"id":41,"type":"complete","exitCode":0}
```

If the host fails before response headers exist, the entire sequence is a
single `error` frame. No frame may follow either terminal frame. Clients retain
the error frame's native code and message instead of replacing an early host
failure with a missing-headers protocol error.

Output frames contain at most 64 KiB before base64 encoding. `sequence` is
global to the request and increases by one across stdout and stderr. The host
uses a bounded eight-frame producer queue; a slow TCP consumer therefore
applies backpressure to PHP instead of growing an unbounded response buffer.
PHP and application-level output buffers remain guest-controlled; a script
must flush or close its active buffers before the host can emit those bytes.
Stderr produced before PHP commits its headers is held in the same bounded
host budget, then emitted immediately after the single headers frame. The
headers frame is limited to 1,024 fields and 64 KiB of raw names and values.

The `cli` stream uses the same frame sequence and cancellation endpoint:

```json
{
	"protocolVersion": 2,
	"id": 42,
	"method": "cli",
	"params": {
		"argv": ["php", "/tmp/wp-cli.phar", "--version"],
		"env": { "WP_CLI_ALLOW_ROOT": "1" },
		"cwd": "/wordpress"
	}
}
```

Only a command whose basename is exactly `php` is accepted. The host inserts
the managed `/internal/shared/php.ini`, invokes PHP's real CLI SAPI in a fresh
component, and streams stdout/stderr plus the real exit code. Empty non-command
arguments are preserved. Arrays must be dense; argv, environment, each entry,
and aggregate bytes are bounded and reject NUL. A CLI component reserves one
configured worker slot, including a capacity-only lazy reservation that does
not instantiate an unused HTTP component.

The Node client also keeps at most eight frames per channel in memory. If a
caller leaves one channel unread, overflow is written losslessly to private
temporary spool files and can be read later; this lets the parser reach the
terminal frame without unbounded RAM or a cross-channel deadlock.

Cancellation uses:

```json
{ "protocolVersion": 2, "id": 41 }
```

The response is a normal RPC envelope whose result is
`{ "cancelled": true | false }`.

Cancelling either public output stream cancels the entire request. Cancellation,
client disconnect, or an output-channel failure interrupts the selected
Wasmtime Store. Guest execution and `wasi:io/poll` waits such as PHP `sleep`
are cancellation-aware; an arbitrary synchronous host operation may finish
before the Store observes cancellation. A streamed HTTP companion is discarded
and rebuilt on demand; a transient CLI Store is dropped and its capacity
reservation is released. Other workers remain available.

`cp` recursively merges regular files and directories, rejects source and
destination symlinks, and reports one `filesystem.write` event for the
requested destination. Its exact RPC envelope is:

```json
{
	"protocolVersion": 2,
	"id": 1,
	"method": "cp",
	"params": { "fromPath": "/wordpress/source", "toPath": "/wordpress/copy" }
}
```

Replacing `/internal/shared/php.ini` through
`writeFile`, or copying a file to that path directly or as part of a directory
tree, advances the worker configuration generation. Direct `writeFile`
replacement is same-directory atomic. The
guest sees `/internal/shared` read-only; control writes operate on the private
host directory rather than through the guest preopen. Existing
HTTP Stores are rebuilt on their next checkout; subsequent CLI Stores load the
new file directly, without a global request lock.

## Event stream

Supported SSE event names are `ready`, `shutdown`, `request.end`,
`request.error`, and `filesystem.write`. The npm bridge maps `ready` and
`shutdown` to one `runtime.initialized` and `runtime.beforeExit` notification
per logical proxy and dispatches the upstream `*` listener locally; those
synthetic names never arrive on this wire. `onMessage()` and
PHP-to-JavaScript message events are intentionally outside the native v1
contract.

## Limits and failures

- At most 64 control connections are active at once.
- Control request headers and request bodies are bounded before allocation.
- Buffered JSON bodies are limited to 128 MiB encoded.
- Stream header frames and every decoded NDJSON line are size-limited before
  object parsing.
- Stream response size is not globally capped; per-frame and queue limits
  plus disk-backed client overflow provide bounded RAM.
- Recursive `cp` is synchronous, non-cancellable, and non-transactional. It
  does not roll back earlier children after a later failure or disconnect, and
  it resolves the host tree rather than nested VFS mount overlays.
- CLI argv and environment lists each contain at most 4,096 entries, each
  string is at most 1 MiB, and the aggregate is at most 8 MiB.
- Protocol errors use the shared `ERR_WP_PLAYGROUND_NATIVE_*` taxonomy and
  never include the bearer token, authorization header, or child environment.
