<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# WordPress Playground RPC compatibility decisions

This record describes the first, deliberately narrow rollout of the independent
Playground RPC implementation. It is an engineering record, not a legal-clearance
determination.

## Rollout boundary

This change opts only `@wp-playground/cli` into the new implementation. The CLI's
main thread, Blueprint workers, and dedicated synchronous file-lock channels all
import `@php-wasm/universal/playground-rpc`.

The existing `@php-wasm/universal` entry point and its RPC exports remain in place
for every other consumer. In particular, the browser client, remote iframe,
website, PHP web worker, Telex, Studio, and direct users of the package root do not
move to the new wire protocol in this change.

The new implementation has a separate package subpath so the two implementations
can coexist without accidentally pairing a new client with a legacy remote. The
CLI packages both ends of each channel together and therefore upgrades them as one
unit.

## Playground-facing surface used by the CLI

The `@php-wasm/universal/playground-rpc` subpath provides:

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

The CLI relies on asynchronous calls and nested property reads, receiver
preservation, callbacks, readiness, explicit release, structured-cloned values,
transfer lists, response and stream codecs, and synchronous calls for file locks.
The existing CLI API is intended to remain unchanged; the replacement is internal
to its worker channels.

## Deliberately omitted behavior

No approved CLI call site requires these general-purpose proxy features, so they
are outside the new protocol:

| Behavior                   | Decision                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Remote property assignment | Omitted. Use an explicit remote method.                                                              |
| Remote construction        | Omitted. Expose and call a factory method.                                                           |
| Generic proxy marking      | Omitted. Only callbacks and documented codecs cross by reference or special representation.          |
| Automatic finalization     | Omitted. The endpoint owner releases the proxy or aborts the session explicitly.                     |
| Special `.bind()` behavior | Omitted. Normal method invocation preserves the containing object as `this`.                         |
| Per-operation cancellation | Omitted. The owner lifecycle signal terminates the session; stream cancellation uses its own bridge. |

Assignment and construction throw `RPCUnsupportedOperationError`. Object
enumeration, reflective proxy identity, arbitrary symbols, and other generic
membrane behavior are not promised.

## Lifetime guarantees

Each consumed endpoint has one session. It owns pending requests, listeners,
derived property proxies, callback references, transferred ports, returned
streams, and deferred values.

Release, owner abort, a remote termination message, or an observed endpoint event
causes one terminal transition. That transition rejects pending work, prevents new
messages, detaches listeners, closes owned ports, errors returned streams, rejects
deferred values, and invalidates callbacks and derived proxies. Repeated cleanup is
safe.

Node worker exit, Node `MessagePort` close, and child-process disconnect, exit,
close, and error are observed automatically. Browser platforms cannot reliably
report every worker termination, iframe removal or navigation, renderer failure,
or remote self-termination. A future browser integration must pass one owner
`AbortSignal` when constructing the endpoint and abort it when the owner makes the
endpoint unusable. This first rollout does not change browser integration.

Asynchronous calls have no arbitrary deadline because PHP work can legitimately
run for a long time. Synchronous calls have a configurable bounded deadline, with
a 30-second default, because a thread blocked in `Atomics.wait()` cannot process
ordinary asynchronous close events. A lost sync endpoint can therefore surface as
`SyncRPCOperationTimeoutError` when loss cannot be observed before the wait begins.

## Protocol and mixed versions

The new protocol marker is `wordpress-playground-rpc`; its first wire version is
`1`. Here, “version” means the format of messages exchanged across an endpoint,
not the npm package version. The envelope, codecs, bootstrap, stream bridges, and
synchronous format are documented in [RPC-PROTOCOL.md](./RPC-PROTOCOL.md).

Peers that recognize the marker but use different versions terminate with
`RPCProtocolVersionMismatchError`. A legacy peer uses a different marker and is
not compatible with the new protocol. The separate import boundary prevents that
combination inside the CLI. Future changes to the CLI wire format must update both
ends together.

## Transfer and transport decisions

Structured clone is the default. Defined codecs cover callbacks, `CustomEvent`,
`MessagePort`, readable streams, branded PHP stdin events, `PHPResponse`,
`StreamedPHPResponse`, `Error` values, and non-`Error` thrown values. Streams use a
native transfer when selected and supported, or a private `MessagePort` bridge.

Transfer-policy hooks return the exact additional transfer list. The runtime does
not scan arbitrary object graphs, and it deduplicates codec and policy transfer
lists before posting.

Browser workers, browser and Node message ports, and Node worker-thread workers
can carry transfer lists. Node child-process IPC cannot; requesting one throws
`RPCUnsupportedTransferError`. Child-process use requires Node's advanced
serialization mode.

Although the engine includes adapters for the transports above and a private
Window bootstrap, only the CLI's Node worker-thread and `MessagePort` paths are
adopted by this PR. Browser adoption and its cross-browser lifecycle validation
remain a later integration step.

## Consumer impact

- Playground CLI: worker communication changes internally; its public commands,
  options, and return values remain unchanged.
- Telex, Studio, browser Playground, and direct root-package consumers: no RPC
  implementation change in this PR.
- wp-env and other CLI consumers: no intended API change; their packaged CLI path
  exercises the new internal RPC and must be validated by built-package tests.

Any later rollout to an independently deployed worker or iframe will need a
coordinated client/remote upgrade and an explicit browser lifecycle owner.
