<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# WordPress Playground RPC protocol version 1

This document defines the independently designed wire contract exported from
`@php-wasm/universal/playground-rpc`. Version `1` identifies this message format;
it is independent of the npm package version. It is intended for version review
and coordinated deployment, not as an invitation to treat the implementation as
a general-purpose RPC framework.

The first rollout uses this protocol only between Playground CLI processes and
worker threads. The package-root RPC exports remain unchanged for browser and
other consumers. The Window, browser-worker, and child-process sections document
implemented transport contracts for later integrations; they do not expand the
scope of this rollout.

All object fields described as required must have the stated type. Receivers
ignore envelopes with another marker or session. They reject or ignore malformed
fields as described below; they never dispatch an unvalidated API path.
Protocol-version fields are nonnegative ECMAScript safe integers. A malformed
`protocol-error` (including a missing/invalid `remoteVersion` or a non-string
optional `message`) is ignored and cannot terminate a session.

## Main asynchronous protocol

Every asynchronous envelope has these required fields:

| Field      | Version 1 value                                            |
| ---------- | ---------------------------------------------------------- |
| `protocol` | The literal `wordpress-playground-rpc`                     |
| `version`  | The number `1`                                             |
| `session`  | The opaque session identifier established by the handshake |
| `kind`     | One of the kinds below                                     |

The client chooses the session identifier. The server binds an unbound endpoint
to the first valid `hello`, or checks an expected identifier supplied by the
private Window bootstrap. A request identifier is unique within one direction
of one session. Locally generated request and callback identifiers use `c-` or
`s-` role prefixes as a diagnostic convention, not as an authorization
mechanism.

| `kind`             | Sender       | Additional required or optional fields                                    | Meaning                                                                                            |
| ------------------ | ------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `hello`            | Client       | None                                                                      | Proposes the envelope version and session. It may be retried.                                      |
| `hello-ack`        | Server       | None                                                                      | Accepts the version and session.                                                                   |
| `protocol-error`   | Either peer  | `remoteVersion: number`; optional `message: string`                       | Rejects an unsupported protocol version. The envelope's `version` identifies the sender's version. |
| `request`          | Either peer  | `requestId: string`, `operation`, `args`; operation-specific fields below | Starts a call, read, or callback invocation.                                                       |
| `response`         | Either peer  | `requestId: string` and exactly one of `value` or `error`                 | Settles one pending request.                                                                       |
| `callback-release` | Either peer  | `callbackId: string`                                                      | Removes the corresponding local callback reference.                                                |
| `release`          | Consumer     | None                                                                      | Releases the complete session.                                                                     |
| `terminate`        | Either owner | Optional `message: string`                                                | Announces an owner-driven terminal transition.                                                     |

Version 1 request operations are deliberately limited:

| `operation` | Required fields                              | Dispatch                                                               |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `get`       | `path: string[]`, `args: []`                 | Reads and awaits the property at `path`.                               |
| `call`      | `path: string[]`, `args: RPCWireValue[]`     | Calls the value at `path`, preserving the containing object as `this`. |
| `callback`  | `callbackId: string`, `args: RPCWireValue[]` | Invokes a callback registered in the opposite direction.               |

Paths contain at most 64 components, each at most 1024 characters.
`__proto__`, `prototype`, and `constructor` are forbidden. Property assignment,
construction, reflective enumeration, generic proxy marking, and synthetic
`bind` operations have no version 1 message kind.

Responses can arrive out of order. A peer removes the matching pending entry
before resolving or rejecting it. Duplicate and unexpected responses do not
settle anything. A valid but unknown request kind receives a serialized error;
an unrelated or malformed envelope is ignored.

## Values and errors

An `RPCWireValue` has one of these shapes:

```text
{ representation: "clone", value: <structured-clone value> }
{ representation: "codec", codec: <identifier>, value: <codec payload> }
```

Version 1 defines these codec identifiers:

| Identifier                            | Payload purpose                                                 |
| ------------------------------------- | --------------------------------------------------------------- |
| `playground.callback.v1`              | A session-owned callback identifier                             |
| `playground.custom-event.v1`          | Event type, encoded detail, and event flags                     |
| `playground.message-port.v1`          | A transferred `MessagePort`                                     |
| `playground.readable-stream.v1`       | A native stream or stream-bridge port                           |
| `playground.php-event-stdin.v1`       | Branded PHP event data and its stdin stream                     |
| `playground.php-response.v1`          | Buffered response status, headers, bytes, errors, and exit code |
| `playground.streamed-php-response.v1` | Headers/stdout/stderr streams and an exit-code bridge port      |
| `playground.error-value.v1`           | An `Error` used as an ordinary value                            |

An unknown codec identifier is a serialization failure. Codec and policy
transfer lists are combined and deduplicated by identity. Transfer-policy hooks
provide the exact additional list; the protocol does not discover nested
transferables by walking an arbitrary object graph.

A thrown non-`Error` uses `{ kind: "value", value: RPCWireValue }`. A thrown
`Error` uses `{ kind: "error", error }`, where `error` contains required
`name`, `message`, `originalClassName`, and `properties`, plus optional `stack`
and recursively encoded `cause`. Dangerous property names are not reconstructed.

## Window bootstrap protocol

The shared `Window` channel carries only this bootstrap envelope:

```text
{
  protocol: "wordpress-playground-rpc-bootstrap",
  version: 1,
  kind: "connect",
  session: <main-protocol session identifier>
}
```

It must transfer exactly one newly created `MessagePort`. The iframe accepts it
only from the configured parent window and an exact configured origin. The
client sends its main-protocol `hello` on that private port. It promotes a port
only after a matching current-version `hello-ack` or a well-formed
`protocol-error`; malformed attempts are left inactive and a later handshake
retry can create a new private port. Normal RPC traffic never returns to the
shared Window channel.

## Stream and deferred bridges

The portable stream marker is `wordpress-playground-stream-bridge`, version `1`.
Every bridge message has `protocol`, `version`, an opaque `channel` identifier,
and one of these kinds:

| Kind     | Additional fields                      | Direction            |
| -------- | -------------------------------------- | -------------------- |
| `chunk`  | `bytes: ArrayBuffer`                   | Producer to consumer |
| `close`  | None                                   | Producer to consumer |
| `error`  | Serialized name/message/optional stack | Producer to consumer |
| `cancel` | None                                   | Consumer to producer |

The deferred marker is `wordpress-playground-deferred-bridge`, version `1`.
Its messages have the same common fields and either `resolve` with `value`, or
`reject` with a serialized error. Each bridge owns a private `MessagePort` and
closes it on settlement, cancellation, or session termination. Bridge versions
do not negotiate or fall back.

## Synchronous protocol

Synchronous RPC uses the main marker and version on a dedicated `MessagePort`.
It permits only method calls and these envelope kinds:

| `kind`           | Additional fields                                                             | Meaning                         |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `sync-hello`     | None                                                                          | Proposes a session.             |
| `sync-hello-ack` | None                                                                          | Accepts it.                     |
| `protocol-error` | `remoteVersion: number`                                                       | Reports a mismatch.             |
| `sync-request`   | `requestId`, safe `path`, string `payload`, `sharedBuffer: SharedArrayBuffer` | Starts one bounded method call. |
| `release`        | None                                                                          | Closes the session.             |

The payload is JSON with explicit tagged representations for `bigint`,
`undefined`, non-finite numbers, `Map`, `Set`, `Uint8Array`, and `ArrayBuffer`.
Functions and symbols are unsupported. The shared buffer starts with two
`Int32` cells for status and byte length, followed by the UTF-8 response payload.
Status values distinguish success, remote error, oversized response, and known
endpoint termination. `Atomics.notify()` wakes the caller. A caller that is
already blocked cannot process an asynchronous close event, so every sync call
has a finite deadline and an externally lost endpoint may surface as timeout.

## Transport requirements and version changes

Browser and Node workers and message ports use their platform structured-clone
and transfer-list facilities. Node child-process endpoints require
`fork(..., { serialization: "advanced" })`; the default JSON IPC mode is not a
version 1 transport. Child-process transfer lists are always rejected.

Recognized peers with different main versions exchange `protocol-error` and
terminate with `RPCProtocolVersionMismatchError`. An endpoint with an unrelated
marker cannot participate in that exchange, so the recognized peer remains
pending until its owner aborts. A future incompatible change to an envelope,
operation, codec payload, bootstrap, or bridge must increment the corresponding
version and coordinate every independently cached client, worker, iframe,
remote page, and service worker that crosses that boundary.
