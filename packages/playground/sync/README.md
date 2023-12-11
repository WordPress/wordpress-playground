## Playground Sync

Experimental support for synchronizing data between two Playground instances.

To try it, run:

```
nx dev playground-sync
```

## How does it work?

We record local changes, send them to over a remote peer, and replay them there. The following changes are supported:

-   SQL Queries (INSERT, DELETE, ALTER TABLE etc)
-   Filesystem changes (create, delete, rename, etc)

### SQL syncing strategy:

Whenever the local WordPress issues a query, we record it in a buffer and broadcast it to the remote peer. The remote peer then receives the query and executes it.

Whenever a local autoincrement value is generated:

1. We override the SQLite-assigned sequence value with the next relevant value from playground_sequence.
2. We fetch the entire row from the database and transmit it as JSON to the remote peer.

See `src/sync-mu-plugin.php` for the implementation.

### What about conflicting autoincrement IDs?

We're sharding IDs to avoid conflicts. For example, peer 1 could start all autoincrement sequences at `12345000001`, while peer 2 could start at `54321000001`. This gives both peers have a lot of space to create records without assigning the same IDs.

In some ways, this is similar to [ID sharding once described on Instagram's engineering blog](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c?gi=2f1ad5d97db2).

### What if we run out of space to assign new IDs?

Currently, that would create a conflict and cause the two peers to diverge forever.

In the future, we could rewrite these high IDs to reclaim the space. Here's how it could work:

1. Alice assigns a high autoincrement ID (e.g. `1234500001`) and marks it as "dirty"
2. Alice sends the change to Bob
3. Bob finds the available next low ID (e.g. `35`) and establishes a mapping between `1234500001` and `35`
4. Bob starts rewriting all occurences of `1234500001` to `35` in all SQL queries received from Alice
5. Bob rewrites and applies the received query
6. Bob sends a confirmation to Alice that the record was "committed" with ID `35`
7. Alice rewrites all local instances of `1234500001` with `35` like Bob did
8. Alice sends a confirmation to Bob that she reconciled `1234500001` as `35` and Bob may stop rewriting it

The rewriting is needed because sometimes ids are stored inside serialized data such as JSON or PHP's `serialize()` output. It's an imperfect heuristics that would occasionally rewrite data that was the same as our ID but had a different meaning, but perhaps it wouldn't happen that often. That's the best we can do anyway. There's no way to reason about the meaning of arbitrary serialized data as it can come from any WordPress plugin.
