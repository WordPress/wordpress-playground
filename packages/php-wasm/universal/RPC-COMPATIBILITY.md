<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# WordPress Playground RPC compatibility decisions

This record describes the intended compatibility boundary of the independent
WordPress Playground RPC layer. It records engineering behavior for integrators
and does not make a legal-clearance determination.

The complete version 1 envelope, codec, bootstrap, bridge, and synchronous wire
contract is recorded in [RPC-PROTOCOL.md](./RPC-PROTOCOL.md).

## Preserved Playground-facing surface

The following exports remain the supported integration surface:

- `consumeAPI()` and `exposeAPI()`;
- `consumeAPISync()` and `exposeSyncAPI()`;
- `Remote<T>` and `RemoteAPI<T>`;
- `PublicAPI`;
- `WithAPIState` and `WithIsReady`;
- `releaseApiProxy`;
- `ConsumeAPIOptions`;
- `RemoteAPIEndpointTerminatedError`;
- `APITransferable`;
- `APITransferPolicy` and `defineAPITransferPolicy()`;
- `streamToPort()` and `portToStream()`; and
- the `NodeProcess` transport type.

Preserved behavior includes asynchronous method calls, awaitable nested property
paths, method receiver preservation, callbacks with results and errors, piped
APIs, `isConnected()`, `isReady()`, explicit release, structured-cloned values,
explicit transfer lists, and the synchronous method calls used by
`FileLockManager`.

This is source-level Playground API compatibility, not wire compatibility. The
RPC marker is `wordpress-playground-rpc` and the initial protocol version is
`1`. Peers that recognize this marker but advertise different versions fail
their handshake with `RPCProtocolVersionMismatchError`. There is no
previous-protocol fallback.

## Deliberately omitted behavior

No approved Playground dependency requires the following general-purpose proxy
features, so they are intentionally outside the contract:

| Behavior                   | Decision                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote property assignment | Omitted. A proxy assignment throws `RPCUnsupportedOperationError`; use an explicit remote method.                                                                               |
| Remote construction        | Omitted. Calling a proxy with `new` throws `RPCUnsupportedOperationError`; expose a factory method instead.                                                                     |
| Generic proxy marking      | Omitted. Only callbacks and the documented Playground codecs cross by reference or special representation. Other values use structured clone.                                   |
| Automatic finalization     | Omitted. Owners must call `proxy[releaseApiProxy]()` and/or abort the endpoint lifecycle signal. Cleanup must not depend on garbage-collection timing.                          |
| Special `.bind()` behavior | Omitted. Remote paths do not expose a synthetic `bind`; invoke the method normally. The server preserves the containing object as `this`.                                       |
| Per-operation cancellation | Omitted. No approved call site needs a generic cancellation message. The owner `AbortSignal` terminates the whole session; only stream cancellation crosses its private bridge. |

Object enumeration, reflective proxy identity, arbitrary symbols, and other
general JavaScript membrane behavior are likewise not promised. An object-valued
remote path is either extended to another path or awaited for a value.

## Window origin compatibility change

Window-to-iframe communication now uses the shared `Window` channel only to
transfer a private bootstrap `MessagePort`. The bootstrap accepts exactly one
port and checks both the expected source window and an exact allowed origin.
Normal RPC traffic then uses only that private port.

This creates an intentional configuration requirement:

- `consumeAPI(window, { targetOrigin })` requires an exact origin for a
  cross-origin target when it cannot be inferred from the supplied context;
- the positional `context` overload remains available to discover the origin of
  a matching iframe;
- `exposeAPI(..., { allowedOrigins })` accepts one exact origin or a list;
- `parentWindow` can pin the expected source and defaults to `window.parent`;
- `allowedOrigins` defaults to the origin derived from `document.referrer` when
  available; and
- a referrer-suppressed iframe must configure `allowedOrigins` explicitly.

`*`, the opaque origin string `null`, and origins containing a path are
rejected. Opaque-origin iframes would require wildcard targeting and are not
supported by this safety model. Deployments that previously relied on wildcard
`postMessage` targeting or did not coordinate cross-origin iframe configuration
must change their setup.

## Consumer impact

| Consumer        | Expected impact                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telex           | Calls through the preserved Playground API remain source-compatible. A separately deployed iframe or worker must be released in coordination with its client, and cross-origin iframe deployments must provide matching `targetOrigin` and `allowedOrigins`.                       |
| Studio          | Calls through the preserved API remain source-compatible. The component that owns each worker or iframe should pass one `AbortSignal` at construction and abort it on termination, removal, or navigation. Separately deployed endpoints must upgrade protocol versions together.  |
| wp-env          | Node API calls remain source-compatible. Worker-thread and port endpoints observe their Node lifecycle events. Child-process IPC cannot carry transfer lists, and synchronous calls require a dedicated `MessagePort`.                                                             |
| Other consumers | Direct users of assignment, construction, generic proxy marking, finalization-based cleanup, synthetic `bind`, wildcard Window bootstrap, or a previous wire protocol must migrate to explicit methods, release/lifecycle ownership, exact origins, and matched endpoint versions. |

This record does not claim that every downstream deployment topology has been
inspected. Integrators must check whether they deploy the consuming bundle and
the worker or iframe document independently; that deployment boundary determines
whether a coordinated protocol upgrade is required.

## Lifetime guarantees

Each consumed endpoint has one session that owns pending requests, endpoint
listeners, derived property proxies, callback references, transferred ports,
returned streams, and deferred values.

Release, owner abort, remote release/termination, or an observed endpoint event
causes one atomic terminal transition. The transition rejects all pending
operations, rejects new operations before posting, detaches listeners, closes
owned ports, errors or cancels returned streams, rejects deferred exit-code
promises, and invalidates callbacks and derived proxies. Repeated cleanup is
safe and deterministic.

Node worker exit, Node `MessagePort` close, and child-process disconnect, exit,
close, and error are observed automatically. Browser error, message-error, and
available port-close signals are also observed.

Browser platforms do not reliably notify a consumer for every worker
`terminate()`, iframe removal, navigation, renderer failure, or remote
self-termination. The component that creates the browser worker or iframe must
therefore provide one lifecycle `AbortSignal` and abort it whenever it makes the
endpoint unusable. If neither a browser event nor the owner signal fires, a
handshake or asynchronous request can remain pending. The implementation does
not describe such a case as detected.

Asynchronous calls have no arbitrary short timeout because PHP operations can
legitimately run for a long time. Synchronous calls have a configurable bounded
deadline, with a compatibility default of 30 seconds, because a thread blocked
in `Atomics.wait()` may not process asynchronous endpoint events. Timeout,
remote exception, serialization failure, and known endpoint termination remain
distinct errors.

Endpoint loss is distinct only when the exposing side can reflect it into the
shared response buffer before wake-up, or when the consuming thread observed it
before the call. If a worker or process disappears externally while the caller
is blocked, the ordinary close listener cannot run on that blocked thread and
the call necessarily reaches `SyncRPCOperationTimeoutError` instead.

## Transfer and transport compatibility

Structured clone remains the default. Defined codecs cover callbacks,
`CustomEvent`, `MessagePort`, readable streams, branded PHP stdin events,
`PHPResponse`, `StreamedPHPResponse`, `Error` values, and non-`Error` thrown
values. Streams use native transfer when selected and supported or a private
`MessagePort` bridge otherwise.

The portable stream bridge is a separately versioned mini-protocol with marker
`wordpress-playground-stream-bridge` and version `1`. Deferred values use
`wordpress-playground-deferred-bridge`, also version `1`. These bridges do not
negotiate or fall back. A marker/version mismatch is ignored and the consumer
eventually sees the bridge port close rather than a normal stream or deferred
completion.

Transfer-policy hooks return the exact additional transfer list. The runtime
does not recursively scan arbitrary returned or argument object graphs, and it
deduplicates the codec and policy lists before posting. This can expose an
integration difference for a caller that previously expected an unlisted nested
transferable to be discovered automatically: it must now declare that value in
`transferArguments()` or `transferResult()`.

Browser workers, browser and Node message ports, and Node worker-thread workers
support transfer lists. Node child-process IPC does not; requesting a transfer
there fails with `RPCUnsupportedTransferError` rather than silently copying or
dropping ownership. Child-process endpoints must be created with Node's
`fork(..., { serialization: 'advanced' })` option so structured values are
preserved. Node's default JSON IPC mode is not a supported RPC transport
configuration.

## Protocol deployment policy

The marker, version, session, kind, and correlation identifier are validated
before dispatch. Messages for another protocol or session cannot settle a
pending request. Dangerous path components are rejected. Unsupported versions
within this protocol family are terminal and produce a clear version-mismatch
error.

Treat the client and its worker/iframe/remote bundle as one deployable versioned
unit. If those assets are cached or released independently, use cache busting or
an atomic deployment so a version-1 client does not connect to a future
version-2 remote, or vice versa. Mixed versions fail closed rather than attempting
to interpret one another's messages.

An endpoint using an older, unrecognized protocol marker cannot participate in
the version-error exchange. A new client talking to such a remote keeps its
handshake pending until its owner aborts the lifecycle signal; asynchronous calls
queued behind that handshake remain pending too. A legacy client talking to the
new remote receives no response because the new remote ignores unrelated
markers; the legacy client's own implementation determines how it eventually
reports that absence. In neither direction is the pair compatible. This is why
independently cached client and remote assets must be deployed atomically and
why every browser owner must supply a lifecycle signal.

The remote page also passes `streamToPort()` results to Playground's installed
service worker, which consumes them with `portToStream()`. That remote-page /
service-worker pair is therefore another independently cached deployment
boundary. Its assets must coordinate the bridge version during service-worker
updates; mixing versions can fail an in-flight request even when the main RPC
client and remote use matching versions.

## Source basis and provenance

This decision record was written from only:

- the clean-room behavioral specification supplied for this task;
- the repository's supplied `AGENTS.md` instructions;
- `packages/php-wasm/universal/src/lib/api.ts`; and
- `packages/php-wasm/universal/src/lib/rpc.ts`.

No external pages, third-party RPC documentation, repository history, built
bundles, source maps, or other RPC/proxy implementations were consulted while
writing this record.
