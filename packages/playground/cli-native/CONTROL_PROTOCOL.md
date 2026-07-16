# Native CLI control protocol

The private `@wp-playground/cli-native` package controls a local
`wp-playground-native` child over authenticated loopback HTTP. The protocol is
an implementation boundary, not a remote API: every URL in the handshake must
use loopback HTTP and every request requires the per-process bearer token.

## Version 2 endpoints

- `POST /rpc` returns one buffered JSON response.
- `POST /rpc/stream` returns an NDJSON response for `requestStreamed`.
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
client disconnect, or an output-channel failure interrupts the Wasmtime Store,
recycles that PHP worker, and leaves other workers available.

## Event stream

Supported SSE event names are `ready`, `shutdown`, `request.end`,
`request.error`, and `filesystem.write`. `onMessage()` and PHP-to-JavaScript
message events are intentionally outside the native v1 contract.

## Limits and failures

- At most 64 control connections are active at once.
- Control request headers and request bodies are bounded before allocation.
- Buffered JSON bodies are limited to 128 MiB encoded.
- Stream header frames and every decoded NDJSON line are size-limited before
  object parsing.
- Stream response size is not globally capped; per-frame and queue limits
  plus disk-backed client overflow provide bounded RAM.
- Protocol errors use the shared `ERR_WP_PLAYGROUND_NATIVE_*` taxonomy and
  never include the bearer token, authorization header, or child environment.
