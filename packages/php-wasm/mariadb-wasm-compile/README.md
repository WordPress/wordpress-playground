# MariaDB → WebAssembly

Compile MariaDB's embedded server (`libmysqld`) to WebAssembly using Emscripten. This gives you a full MariaDB SQL engine running in-process — no TCP server, no daemon, just direct C API calls from JavaScript.

This is an experimental project. MariaDB was never designed for WASM, and there are real limitations (see [Shortcomings](#shortcomings) below). But the embedded server architecture makes it the most viable path: it bundles the SQL parser, optimizer, and storage engines into a single library that talks through function calls instead of sockets.

## Why MariaDB and not MySQL?

MySQL 8.0 removed the embedded server (`libmysqld`). MariaDB still maintains it. That's the entire reason — without an embedded server mode, you'd need to emulate a full TCP daemon inside WASM, which is dramatically harder.

## Prerequisites

**Emscripten** (the C/C++ → WASM compiler):

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

**Build tools**: `cmake`, `make`, a native C/C++ compiler (gcc or clang). These are needed for the host build stage.

On Ubuntu/Debian:

```bash
sudo apt install build-essential cmake bison libncurses-dev
```

On macOS:

```bash
brew install cmake bison
```

## Building

Clone with submodules:

```bash
git clone --recursive https://github.com/user/try-mysql-wasm.git
cd try-mysql-wasm
```

If you already cloned without `--recursive`:

```bash
git submodule update --init
```

Run the build:

```bash
./build.sh
```

This runs three stages:

1. **Host build** — Compiles MariaDB's code-generation tools (`comp_err`, `comp_sql`, `gen_lex_hash`, `gen_lex_token`, `factorial`, `uca-dump`) natively. These tools run during the build to generate source files (error message tables, SQL keyword hashes, etc.) and can't run as WASM.

2. **WASM cross-compile** — Runs `emcmake cmake` + `emmake make` to cross-compile MariaDB with Emscripten, using the host-built tools from stage 1 via `IMPORT_EXECUTABLES`.

3. **Link** — Links all the static libraries into a final `dist/mariadb.wasm` + `dist/mariadb.js` module.

You can run stages individually:

```bash
./build.sh host    # Stage 1 only
./build.sh wasm    # Stage 2 only
./build.sh link    # Stage 3 only
./build.sh clean   # Remove all build artifacts
```

Control parallelism with `JOBS`:

```bash
JOBS=8 ./build.sh
```

## Usage

The output is an Emscripten module that exposes the MariaDB C API (`mysql_init`, `mysql_query`, `mysql_store_result`, etc.) to JavaScript.

```javascript
import createMariaDB from './dist/mariadb.js';

const db = await createMariaDB();

const mysql_server_init = db.cwrap('mysql_server_init', 'number', ['number', 'number', 'number']);
const mysql_init = db.cwrap('mysql_init', 'number', ['number']);
const mysql_real_connect = db.cwrap('mysql_real_connect', 'number', ['number', 'string', 'string', 'string', 'string', 'number', 'string', 'number']);
const mysql_query = db.cwrap('mysql_query', 'number', ['number', 'string']);
const mysql_store_result = db.cwrap('mysql_store_result', 'number', ['number']);
const mysql_close = db.cwrap('mysql_close', null, ['number']);
const mysql_server_end = db.cwrap('mysql_server_end', null, []);

mysql_server_init(0, 0, 0);
const conn = mysql_init(0);
mysql_real_connect(conn, null, null, null, null, 0, null, 0);

mysql_query(conn, 'CREATE TABLE t (id INT, name VARCHAR(50)) ENGINE=MEMORY');
mysql_query(conn, "INSERT INTO t VALUES (1, 'hello')");

const result = mysql_store_result(conn);
// ... fetch rows ...

mysql_close(conn);
mysql_server_end();
```

See `example/demo.mjs` for a complete working example.

## What's included

The WASM build includes these storage engines:

| Engine            | Type       | Notes                                                                                                     |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| **MEMORY (HEAP)** | In-memory  | Best fit for WASM. All data lives in WASM linear memory. No persistence.                                  |
| **MyISAM**        | File-based | Works through Emscripten's virtual filesystem (MEMFS). Data is volatile unless you use NODEFS in Node.js. |
| **Aria**          | File-based | Crash-safe MyISAM replacement. Same MEMFS caveats as MyISAM.                                              |
| **CSV**           | File-based | Reads/writes CSV files through the virtual filesystem.                                                    |
| **ARCHIVE**       | File-based | Compressed read-heavy storage.                                                                            |
| **BLACKHOLE**     | /dev/null  | Accepts writes, stores nothing. Useful for testing SQL syntax.                                            |
| **SEQUENCE**      | Virtual    | Generates number sequences. No storage needed.                                                            |

## Shortcomings

This is not a production database. It's an experiment in pushing a large C/C++ server codebase into WASM. Here's what doesn't work or works poorly.

### No InnoDB

InnoDB is disabled entirely. It depends on:

- **Asynchronous I/O** (`libaio` or `io_uring`) — these are Linux kernel interfaces with no WASM equivalent.
- **Complex threading** — InnoDB runs background threads for page cleaning, log writing, purging old row versions, and buffer pool management. Emscripten's pthread support exists but has sharp edges (async thread creation, no blocking on the main thread, no POSIX signals).
- **Durable fsync semantics** — InnoDB's crash recovery assumes `fsync()` actually flushes to stable storage. In Emscripten's MEMFS, `fsync()` is a no-op. Everything is volatile.
- **Doublewrite buffer** — assumes specific filesystem behavior that can't be guaranteed in a virtual FS.

This means no transactions, no ACID guarantees, no foreign keys (with enforcement), no row-level locking. You get MyISAM-level functionality: table-level locking, no crash recovery, no rollback.

### No persistence (by default)

With MEMFS (the default), all data disappears when the WASM module is unloaded. You can use NODEFS in Node.js to map directories to real files, or IndexedDB-backed IDBFS in browsers, but neither gives you the durability guarantees a real database expects.

### No networking

The embedded server has no TCP listener. You can't connect to it with `mysql` CLI or any standard database driver. All access is through the in-process C API, which you call via Emscripten's `ccall`/`cwrap`.

### No multi-client concurrency

The embedded server runs single-threaded from the caller's perspective. There's one connection handle, one query at a time. You can create multiple `MYSQL*` handles, but they share the same server state and aren't designed for concurrent access from multiple threads.

### Large binary size

MariaDB is a large codebase. Even with most plugins stripped, expect the `.wasm` file to be 10-30 MB (before gzip). For comparison, sql.js (SQLite compiled to WASM) is ~1 MB. This makes it impractical for casual browser use where download size matters.

### No signals, no fork

Emscripten doesn't support POSIX signals or `fork()`. MariaDB uses signals internally for shutdown coordination and alarm handling. The embedded server path avoids most of this, but some codepaths may hit stub implementations that silently do nothing.

### No prepared statements (possibly)

The embedded server supports prepared statements in theory, but the WASM calling conventions for the binary protocol (which uses `mysql_stmt_*` functions with pointer-heavy structs) may be fragile. Text-mode queries via `mysql_query()` are the safer path.

### No authentication

The embedded server bypasses authentication entirely — you connect as root with no password. This is by design (you're connecting to yourself), but it means you can't test auth plugins or user permission workflows.

### No character set auto-detection

Character set initialization reads system locale settings that don't exist in WASM. The build hardcodes UTF-8 defaults, but edge cases around `SET NAMES`, collation detection, or locale-dependent sorting may behave differently than on a real OS.

### Memory pressure

MariaDB's memory allocator and the SQL optimizer's memory usage patterns were designed for machines with gigabytes of RAM. In WASM, you're constrained by the browser's memory limits (typically 2-4 GB for the entire tab). Complex queries, large temporary tables, or big sort buffers can hit memory limits faster than you'd expect.

### Build is fragile

The Emscripten cross-compilation hits edge cases in MariaDB's build system:

- CMake feature-detection tests (`TRY_RUN`) fail during cross-compilation because the test programs can't execute. The build script hardcodes results for known checks (`STACK_DIRECTION`, `HAVE_IB_GCC_ATOMIC_BUILTINS`) but there may be others.
- Some system headers expected by MariaDB don't exist in Emscripten's sysroot. The build may need patches as MariaDB or Emscripten evolve.
- Upgrading either MariaDB or Emscripten versions may break the build in ways that require manual investigation.

## How this compares to alternatives

| Approach         | Database          | Binary size | Performance     | Fidelity                |
| ---------------- | ----------------- | ----------- | --------------- | ----------------------- |
| **sql.js**       | SQLite → WASM     | ~1 MB       | Fast            | Full SQLite             |
| **PGlite**       | PostgreSQL → WASM | ~3 MB gzip  | Good            | High (single-user mode) |
| **DuckDB-WASM**  | DuckDB → WASM     | ~5 MB       | Fast            | Full DuckDB             |
| **mysql-wasm**   | MySQL in x86 VM   | ~50 MB      | Slow (emulated) | Full MySQL              |
| **This project** | MariaDB → WASM    | ~10-30 MB   | Moderate        | Partial (no InnoDB)     |

If you need an SQL database in the browser and don't specifically need MySQL/MariaDB compatibility, **sql.js** or **PGlite** are more mature choices. This project is useful if you need to test MariaDB-specific SQL syntax, MyISAM behavior, or MariaDB's optimizer in an isolated environment.

## License

The build scripts and wrapper code in this repository are MIT licensed. MariaDB itself is GPL v2 — see `mariadb/COPYING` for details. Any binary distribution of the WASM output must comply with the GPL.
