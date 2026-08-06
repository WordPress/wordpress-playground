<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# Browser cross-process communication

WordPress Playground uses its own small RPC layer to call APIs across workers,
iframes, message ports, and supported Node.js IPC endpoints. The layer is scoped
to Playground's needs: asynchronous method calls and property reads, callbacks,
explicit transfers, streams, readiness, and the synchronous calls required by
the file-lock manager.

The RPC implementation is an internal transport. Application code should use
the exported API helpers instead of creating protocol messages directly.
The repository-level `packages/php-wasm/universal/RPC-PROTOCOL.md` record defines
the complete version 1 envelope, operation, codec, bootstrap, bridge, and
synchronous schemas used for compatibility review.

## Public API

`consumeAPI<T>()` creates a `RemoteAPI<T>` for an asynchronous endpoint.
Methods return promises, and nested properties become awaitable paths:

```ts
const playground = consumeAPI<PlaygroundAPI>(worker, {
	signal: lifecycle.signal,
});

await playground.isConnected();
const documentRoot = await playground.paths.documentRoot;
const result = await playground.files.read(documentRoot);
```

A nested method is invoked with its containing object as `this`. Reading an
object-valued property does not copy the whole remote object eagerly; the
derived proxy can be extended to another path or awaited to fetch its value.

`exposeAPI()` combines the main methods and an optional piped API, and returns:

```ts
const [setReady, setFailed, publicAPI] = exposeAPI(methods, pipedAPI, endpoint, options);
```

`isConnected()` resolves when the versioned transport handshake succeeds.
`isReady()` resolves only after the exposing side calls `setReady()`, and rejects
if it calls `setFailed(error)`. This keeps transport availability separate from
application initialization.

The compatibility types are:

- `Remote<T>`: the promise-returning form of a remote API;
- `RemoteAPI<T>`: `Remote<T>` plus `isConnected()` and `isReady()`;
- `PublicAPI<Methods, PipedAPI>`: the combined exposed API;
- `WithAPIState`, with `isConnected()` and `isReady()`; and
- `WithIsReady`, retained as the historical name for the complete
  `WithAPIState` contract.

Release the root proxy explicitly when its owner is finished with it:

```ts
await playground[releaseApiProxy]();
```

Release is safe to call more than once. A released proxy and all paths derived
from it reject further work without posting another message.

## Versioned sessions and request correlation

Every normal RPC envelope carries:

- the recognizable protocol marker `wordpress-playground-rpc`;
- protocol version `1`;
- a session identifier;
- a message kind; and
- a request identifier when the message belongs to an operation.

The handshake establishes one session for the endpoint. Request identifiers
allow concurrent operations to settle in any order. A response only settles the
matching pending operation in the matching session; duplicate, unexpected,
unrelated, malformed, or differently marked messages do not settle calls.

Incoming paths are bounded and validated. Prototype-mutating components such as
`__proto__`, `prototype`, and `constructor` are rejected. Unknown request kinds
and unknown codec identifiers produce serialization failures instead of being
dispatched as API operations.

Protocol versions are not negotiated. When the peers advertise different
versions, the connection terminates with
`RPCProtocolVersionMismatchError`, which reports the local and remote versions.
There is no fallback to a previous wire format. Independently deployed clients,
workers, and iframe documents must therefore be updated together whenever the
protocol version changes.

That explicit error requires both peers to recognize the
`wordpress-playground-rpc` protocol family. A new client connected to a legacy
endpoint with an unrelated marker receives no recognized handshake response and
remains pending until its owner aborts. The new remote likewise ignores a legacy
client's unrelated traffic, so that client receives no response. Client and
remote assets that can be cached independently must be deployed atomically.

## Window and iframe bootstrap

Normal RPC traffic never uses the shared `Window` message channel. A parent first
sends one bootstrap message with the marker
`wordpress-playground-rpc-bootstrap`, protocol version, and session identifier.
That message transfers exactly one newly created `MessagePort`. The iframe checks
the sender and origin, then all handshake and API traffic moves to the private
port.

On the consuming side, configure an exact target origin for a cross-origin
iframe:

```ts
const api = consumeAPI<PlaygroundAPI>(iframe.contentWindow!, {
	targetOrigin: 'https://playground.example',
	signal: iframeLifecycle.signal,
});
```

For compatibility, a `Window` context may still be supplied in the positional
overload. It is used to find the matching iframe and infer its origin. A
same-origin target can also be inspected directly. If neither method is
possible, `targetOrigin` is required.

On the exposing side, `allowedOrigins` is an exact origin or list of exact
origins. `parentWindow` optionally pins the expected source and defaults to the
iframe's parent:

```ts
exposeAPI(methods, pipedAPI, undefined, {
	allowedOrigins: ['https://app.example'],
	parentWindow: window.parent,
	signal: iframeLifecycle.signal,
});
```

If `allowedOrigins` is omitted, the iframe attempts to infer the parent origin
from `document.referrer`. A suppressed referrer makes that impossible, so the
origin must then be configured. Wildcard and opaque origins are rejected; an
opaque iframe would require wildcard targeting and is not supported by this
safety model.

Messages with the wrong source, origin, marker, shape, session, or number of
ports are ignored. Origin checking protects the bootstrap channel; it does not
turn an exposed API into a general security sandbox. Only trusted callers should
receive a private endpoint to privileged methods.

## Supported endpoints

| Endpoint                            | Transfers                         | Automatically observed lifecycle events                |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------ |
| Browser `Worker`                    | Yes                               | `error`, `messageerror`, and any emitted close event   |
| `Window` / iframe                   | Yes, after private-port bootstrap | Private `MessagePort` close/error events               |
| Browser `MessagePort`               | Yes                               | close, error, and message-deserialization errors       |
| Node.js worker-thread `Worker`      | Yes                               | exit, close, error, and message-deserialization errors |
| Node.js worker-thread `MessagePort` | Yes                               | close, error, and message-deserialization errors       |
| Node.js child-process IPC           | No                                | disconnect, exit, close, and error                     |

Node child-process endpoints must be created with
`fork(..., { serialization: 'advanced' })`. Node's default JSON IPC mode does
not preserve the structured values required by this protocol and is not a
supported configuration.

The same raw endpoint cannot be reserved for conflicting RPC modes. In
particular, synchronous RPC requires its own `MessagePort` and cannot share a
port with asynchronous RPC. Child-process IPC rejects any operation whose codec
or transfer policy requires a transfer list.

## Endpoint lifetime

Pass one `AbortSignal` when consuming or exposing an endpoint. It represents the
lifetime of the worker, iframe, port, or child process rather than one individual
operation:

```ts
const lifecycle = new AbortController();
const api = consumeAPI<PlaygroundAPI>(worker, {
	signal: lifecycle.signal,
});

// The component that owns and terminates the worker does both actions together.
worker.terminate();
lifecycle.abort();
```

One session owns its pending operations, listeners, callback references,
transferred ports, returned streams, and deferred values. Release, owner abort,
an observed endpoint failure, or a remote release performs one terminal
transition. That transition:

- rejects every pending operation;
- rejects new calls and reads before they post messages;
- removes endpoint and abort listeners;
- closes owned ports;
- errors or cancels returned streams;
- rejects deferred values such as a streamed response's exit code; and
- invalidates derived property and callback proxies.

Cleanup is deterministic and idempotent. Endpoint loss is reported as
`RemoteAPIEndpointTerminatedError`, including an endpoint type and reason where
available. Asynchronous PHP operations have no arbitrary operation timeout;
they remain pending until they settle or the session terminates.

Node.js exposes reliable worker, port, and child-process lifecycle events, which
the adapters observe automatically. Browsers cannot reliably report every call
to `Worker.terminate()`, iframe removal, navigation, renderer failure, or remote
self-termination to the JavaScript object that consumes the API. The component
that owns a browser worker or iframe must therefore abort the lifecycle signal
when it terminates, removes, or navigates that resource. Without an observable
event or owner abort, `isConnected()` or an in-flight asynchronous operation may
remain pending.

## Values, codecs, and transfers

Values use structured clone by default. Playground adds explicit codecs for:

- callback functions, including promised results and thrown values;
- `CustomEvent` type, detail, and event flags;
- `MessagePort`;
- `ReadableStream<Uint8Array>`;
- branded PHP events whose `stdin` is a readable stream;
- `PHPResponse`;
- `StreamedPHPResponse`, including headers, stdout, stderr, and `exitCode`;
- `Error` values, including name, message, stack, cause, custom data
  properties, response/source data when present, and original class name; and
- non-`Error` thrown values.

Callbacks are registered within the same session. Calling a received callback
is another correlated RPC request, so its result or error crosses back in the
opposite direction. Releasing the callback proxy removes its remote reference;
terminating the session clears all remaining callback state.

Readable streams use a native transferable stream when supported. Set
`streamTransport` to `native` to require it, `message-port` to require the
portable bridge, or `auto` to feature-detect. The bridge transfers copied byte
chunks over a private port and propagates close, error, cancellation, and session
termination. `streamToPort()` and `portToStream()` expose that bridge for callers
that need it directly.

The stream bridge has marker `wordpress-playground-stream-bridge` and version
`1`; the related deferred-value bridge has marker
`wordpress-playground-deferred-bridge` and version `1`. They do not negotiate a
fallback. The remote page and installed Playground service worker use
`streamToPort()` / `portToStream()` directly, so those independently cached
assets must coordinate bridge versions during service-worker updates. A mixed
pair ignores the unrecognized bridge messages and observes the port closing
instead of a successful stream or deferred-value completion.

`PHPResponse` transfers its owned byte buffer when possible.
`StreamedPHPResponse` transports its three streams and a private deferred-value
port for `exitCode`; losing the session errors the streams and rejects that
promise.

Use `defineAPITransferPolicy()` for transferable values nested inside method
arguments or results:

```ts
const policy = defineAPITransferPolicy({
	transferArguments(path, args) {
		const input = args[0] as { buffer: ArrayBuffer };
		return path.join('.') === 'files.import' ? [input.buffer] : [];
	},
	transferResult(path, result) {
		const output = result as { buffer: ArrayBuffer };
		return path.join('.') === 'files.export' ? [output.buffer] : [];
	},
} satisfies APITransferPolicy<MyAPI>);
```

The hook's returned array is the exact additional transfer list. The runtime
does not recursively search arbitrary object graphs for transferables. Codec and
policy transferables are deduplicated before posting. Standard transfer
ownership rules apply: transferring an `ArrayBuffer`, port, native stream, or
other transferable can detach or move it from the sender.

## Synchronous API

`consumeAPISync<T>(port, options)` establishes a synchronous client on a
dedicated `MessagePort`; `exposeSyncAPI(methods, port, options)` exposes the
corresponding method paths. Client creation is asynchronous because it first
performs a versioned handshake. After that, method invocations block with
`Atomics.wait()` until a response arrives or the deadline expires.

Synchronous calls intentionally support only method paths and their portable
value encoding. They do not support transfer lists or child-process IPC. The
client options are:

- `timeoutMs`: per-call deadline, defaulting to 30 seconds;
- `handshakeTimeoutMs`: connection deadline, defaulting to `timeoutMs` and then
  to 30 seconds;
- `maxResponseBytes`: shared response capacity, defaulting to 1 MiB; and
- `signal`: the endpoint owner's lifecycle signal.

A deadline raises `SyncRPCOperationTimeoutError`; a remote exception is decoded
and thrown; endpoint loss raises `RemoteAPIEndpointTerminatedError`; and an
oversized or malformed response raises `RPCSerializationError`. These cases are
kept distinct because a thread blocked in `Atomics.wait()` cannot depend on its
ordinary asynchronous close listener running promptly.

The endpoint-loss case is available only when the server can write that status
into the shared response buffer before wake-up, or when the client observed the
loss before entering the call. An external worker/process death during
`Atomics.wait()` cannot run the client's ordinary close listener and therefore
surfaces as the bounded `SyncRPCOperationTimeoutError` instead.
