#!/usr/bin/env bash
#
# Build MariaDB's embedded server (libmysqld) as WebAssembly using Emscripten.
#
# This is a two-stage cross-compilation process:
#   Stage 1: Build helper executables natively (comp_err, comp_sql, etc.)
#            These tools generate source files at build time and must run on
#            the host machine, not under WASM.
#   Stage 2: Cross-compile MariaDB for WASM using Emscripten, pointing
#            IMPORT_EXECUTABLES at the Stage 1 output so CMake can find
#            the host-built generators.
#
# The build targets libmysqld (the embedded server library), which provides
# the full MariaDB SQL engine as an in-process library — no TCP sockets, no
# daemon process, just direct C API calls. This is the only viable path to
# running MariaDB in a WASM sandbox.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARIADB_SRC="$SCRIPT_DIR/mariadb"
HOST_BUILD_DIR="$SCRIPT_DIR/build-host"
WASM_BUILD_DIR="$SCRIPT_DIR/build-wasm"
OUTPUT_DIR="$SCRIPT_DIR/dist"

PARALLEL_JOBS="${JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

MARIADB_BRANCH="11.4"

if [ ! -f "$MARIADB_SRC/CMakeLists.txt" ]; then
    echo "MariaDB source not found. Cloning branch $MARIADB_BRANCH..."
    git clone --depth 1 --branch "$MARIADB_BRANCH" --recurse-submodules \
        https://github.com/MariaDB/server.git "$MARIADB_SRC"
fi

if ! command -v emcmake &>/dev/null; then
    echo "Error: Emscripten not found. Install it and run 'source emsdk_env.sh'"
    echo "See: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

if ! command -v cmake &>/dev/null; then
    echo "Error: cmake not found."
    exit 1
fi

echo "=== MariaDB WASM Build ==="
echo "Source:    $MARIADB_SRC"
echo "Host dir:  $HOST_BUILD_DIR"
echo "WASM dir:  $WASM_BUILD_DIR"
echo "Output:    $OUTPUT_DIR"
echo "Jobs:      $PARALLEL_JOBS"
echo ""

# ---------------------------------------------------------------------------
# Stage 1: Native host build — only the helper executables
# ---------------------------------------------------------------------------
# MariaDB's build generates source files using small C/C++ tools like
# comp_err (compiles error message files), comp_sql (compiles SQL scripts
# into C arrays), gen_lex_hash and gen_lex_token (generate the SQL lexer
# hash tables), factorial, and uca-dump. When cross-compiling, these tools
# can't run under the target (WASM), so we build them natively first and
# then tell the cross-compile stage where to find them via
# IMPORT_EXECUTABLES.
# ---------------------------------------------------------------------------

build_host() {
    echo ">>> Stage 1: Building host helper executables..."
    mkdir -p "$HOST_BUILD_DIR"
    cd "$HOST_BUILD_DIR"

    cmake "$MARIADB_SRC" \
        -DCMAKE_BUILD_TYPE=Release \
        -DWITHOUT_SERVER=OFF \
        -DWITH_UNIT_TESTS=OFF \
        -DPLUGIN_INNODB=NO \
        -DPLUGIN_MROONGA=NO \
        -DPLUGIN_TOKUDB=NO \
        -DPLUGIN_ROCKSDB=NO \
        -DPLUGIN_SPIDER=NO \
        -DPLUGIN_SPHINX=NO \
        -DPLUGIN_CONNECT=NO \
        -DPLUGIN_PERFSCHEMA=NO \
        -DPLUGIN_COLUMNSTORE=NO \
        -DPLUGIN_OQGRAPH=NO \
        -DPLUGIN_FEDERATED=NO \
        -DPLUGIN_FEDERATEDX=NO \
        2>&1 | tail -20

    make -j"$PARALLEL_JOBS" import_executables 2>&1 | tail -10

    if [ ! -f "$HOST_BUILD_DIR/import_executables.cmake" ]; then
        echo "Error: import_executables.cmake was not generated"
        exit 1
    fi

    echo ">>> Stage 1 complete. Host executables ready."
    echo ""
}

# ---------------------------------------------------------------------------
# Stage 2: WASM cross-compilation with Emscripten
# ---------------------------------------------------------------------------
# We build the embedded server (libmysqld) which bundles the SQL parser,
# optimizer, and storage engines into a single library. We disable every
# feature that depends on OS primitives that don't exist in WASM:
#   - No dynamic plugins (no dlopen)
#   - No InnoDB (needs libaio/liburing, complex threading, fsync semantics)
#   - No networking plugins
#   - No performance schema (OS instrumentation)
#   - No auth_gssapi (Kerberos)
#   - No backup tools
#
# We keep MyISAM and HEAP (MEMORY) storage engines. HEAP is the best fit
# for WASM since it's purely in-memory. MyISAM is file-based but works
# with Emscripten's virtual filesystem (MEMFS).
# ---------------------------------------------------------------------------

build_wasm() {
    echo ">>> Stage 2: Cross-compiling MariaDB for WASM..."
    mkdir -p "$WASM_BUILD_DIR"
    cd "$WASM_BUILD_DIR"

    # Patch readline.cmake to skip the curses dependency when cross-
    # compiling for Emscripten. The embedded server has no interactive
    # terminal, so readline/curses are never used.
    sed -i.bak 's/FIND_CURSES()/# FIND_CURSES() — skipped for Emscripten/' \
        "$MARIADB_SRC/cmake/readline.cmake"

    # Skip the MariaDB Connector/C build entirely. The embedded server
    # is accessed via direct C API calls (cwrap), not through a client
    # library. The connector needs GnuTLS/OpenSSL which don't exist in
    # the Emscripten sysroot.
    cat > "$MARIADB_SRC/cmake/mariadb_connector_c.cmake" << 'PATCH'
# Stubbed out for Emscripten — we only need the embedded server,
# not the client connector library.
MESSAGE("== Skipping MariaDB Connector/C (not needed for embedded server)")
SET(MARIADB_CONNECTOR_C_VERSION "stub")
PATCH

    # Patch thr_timer.c to skip thread creation. The timer thread
    # manages query timeouts via setitimer/threads — neither works in
    # WASM. For the embedded server this is fine: it's single-threaded
    # and doesn't need timeouts.
    python3 -c "
import sys
path = sys.argv[1]
txt = open(path).read()
# Replace the thread creation block with a simple success return.
# We keep the queue/mutex init but skip the timer_handler thread.
txt = txt.replace(
    '/* Create a thread to handle timers */',
    '/* Create a thread to handle timers */\n'
    '#ifdef __EMSCRIPTEN__\n'
    '  /* Skip timer thread in WASM — no threading, no timeouts needed */\n'
    '  DBUG_RETURN(0);\n'
    '#endif'
)
open(path, 'w').write(txt)
" "$MARIADB_SRC/mysys/thr_timer.c"

    # Patch mysqld.cc so --skip-grant-tables also skips loading
    # the mysql.servers table. Without this, the embedded server
    # errors on "Can't open and lock privilege tables" even with
    # --skip-grant-tables because servers_init() is hardcoded to
    # always read the table.
    sed -i.bak 's/servers_init(0)/servers_init(opt_noacl)/' \
        "$MARIADB_SRC/sql/mysqld.cc"


    # Patch Aria for WASM: skip control file, translog, recovery,
    # and checkpoint threads, but keep maria_init() and pagecache
    # so Aria can handle temp tables.
    python3 -c "
import sys
path = sys.argv[1]
txt = open(path).read()
# Insert an #ifdef block that does the minimal init needed for
# temp tables: maria_init + pagecache, but no control file/translog
txt = txt.replace(
    'static int ha_maria_init(void *p)\n{',
    'static int ha_maria_init(void *p)\n{\n'
    '#ifdef __EMSCRIPTEN__\n'
    '  { int res= 0;\n'
    '  maria_hton= (handlerton *)p;\n'
    '  maria_hton->db_type= DB_TYPE_ARIA;\n'
    '  maria_hton->create= maria_create_handler;\n'
    '  maria_hton->panic= maria_hton_panic;\n'
    '  maria_hton->tablefile_extensions= ha_maria_exts;\n'
    '  maria_hton->commit= maria_commit;\n'
    '  maria_hton->rollback= maria_rollback;\n'
    '  maria_hton->flags= (HTON_CAN_RECREATE | HTON_SUPPORT_LOG_TABLES |\n'
    '                      HTON_NO_ROLLBACK |\n'
    '                      HTON_TRANSACTIONAL_AND_NON_TRANSACTIONAL);\n'
    '  bzero(maria_log_pagecache, sizeof(*maria_log_pagecache));\n'
    '  maria_tmpdir= &mysql_tmpdir_list;\n'
    '  res= maria_init();\n'
    '  if (!res) {\n'
    '    res= !init_pagecache(maria_pagecache,\n'
    '                         (size_t) pagecache_buffer_size, pagecache_division_limit,\n'
    '                         pagecache_age_threshold, maria_block_size, pagecache_file_hash_size,\n'
    '                         0);\n'
    '  }\n'
    '  if (!res) {\n'
    '    res= !init_pagecache(maria_log_pagecache,\n'
    '                         TRANSLOG_PAGECACHE_SIZE, 0, 0,\n'
    '                         TRANSLOG_PAGE_SIZE, 0, 0);\n'
    '  }\n'
    
    '  if (res)\n'
    '    maria_hton= 0;\n'
    '  maria_multi_threaded= maria_in_ha_maria= TRUE;\n'
    '  maria_create_trn_hook= maria_create_trn_for_mysql;\n'
    '  maria_pagecache->extra_debug= 1;\n'
    '  return res; }\n'
    '#endif'
)
open(path, 'w').write(txt)
" "$MARIADB_SRC/storage/maria/ha_maria.cc"

    # Patch pcre.cmake for Emscripten cross-compilation:
    # 1. Pass the toolchain file so cmake knows we're targeting WASM
    # 2. Strip macOS-specific -arch/-isysroot flags from C flags that
    #    get inherited from the parent cmake and break emcc
    python3 -c "
import sys
path = sys.argv[1]
txt = open(path).read()
# Add toolchain file to ExternalProject cmake args
txt = txt.replace(
    '\"-DCMAKE_C_COMPILER=\${CMAKE_C_COMPILER}\"',
    '\"-DCMAKE_C_COMPILER=\${CMAKE_C_COMPILER}\"\n'
    '      \"-DCMAKE_TOOLCHAIN_FILE=\${CMAKE_TOOLCHAIN_FILE}\"'
)
# Strip macOS flags from pcre2_flags before they're passed
txt = txt.replace(
    'SET(pcre2_flags\${v} \"\${CMAKE_C_FLAGS\${v}}\")',
    'STRING(REGEX REPLACE \"-arch [^ ]+\" \"\" _clean_flags\${v} \"\${CMAKE_C_FLAGS\${v}}\")\n'
    '    STRING(REGEX REPLACE \"-isysroot [^ ]+\" \"\" _clean_flags\${v} \"\${_clean_flags\${v}}\")\n'
    '    SET(pcre2_flags\${v} \"\${_clean_flags\${v}}\")'
)
open(path, 'w').write(txt)
" "$MARIADB_SRC/cmake/pcre.cmake"

    # Also skip building client tools, tests, and the minbuild/smoketest
    # targets which depend on the connector library we just stubbed out.
    python3 -c "
import re, sys
path = sys.argv[1]
txt = open(path).read()
txt = txt.replace('ADD_SUBDIRECTORY(client)', '# ADD_SUBDIRECTORY(client)')
txt = txt.replace('ADD_SUBDIRECTORY(tests)', '# ADD_SUBDIRECTORY(tests)')
# Comment out the entire IF(NOT WITHOUT_SERVER) block at the end that
# defines minbuild and smoketest targets (they need client binaries).
# Remove the final IF(NOT WITHOUT_SERVER) block that defines minbuild
# and smoketest targets. We find the last occurrence and remove
# everything from it to its matching ENDIF() (handling nesting).
idx = txt.rfind('IF(NOT WITHOUT_SERVER)')
if idx >= 0:
    depth = 0
    i = idx
    end_idx = len(txt)
    while i < len(txt):
        line = ''
        j = txt.find('\n', i)
        if j < 0: j = len(txt)
        line = txt[i:j].strip().upper()
        if line.startswith('IF(') or line.startswith('IF ('):
            depth += 1
        elif line.startswith('ENDIF'):
            depth -= 1
            if depth == 0:
                end_idx = j + 1
                break
        i = j + 1
    txt = txt[:idx] + '# minbuild/smoketest targets skipped for Emscripten\n' + txt[end_idx:]
open(path, 'w').write(txt)
" "$MARIADB_SRC/CMakeLists.txt"

    emcmake cmake "$MARIADB_SRC" \
        -DCMAKE_BUILD_TYPE=Release \
        -DIMPORT_EXECUTABLES="$HOST_BUILD_DIR/import_executables.cmake" \
        \
        -DSTACK_DIRECTION=-1 \
        -DHAVE_IB_GCC_ATOMIC_BUILTINS=1 \
        \
        -DWITH_EMBEDDED_SERVER=ON \
        -DWITHOUT_SERVER=OFF \
        -DWITHOUT_DYNAMIC_PLUGINS=1 \
        -DDISABLE_SHARED=1 \
        -DENABLED_PROFILING=OFF \
        -DENABLE_DTRACE=OFF \
        -DWITH_SAFEMALLOC=OFF \
        \
        -DWITH_SSL=bundled \
        -DWITH_ZLIB=bundled \
        \
        -DWITH_UNIT_TESTS=OFF \
        -DWITH_MARIABACKUP=OFF \
        -DWITH_WSREP=OFF \
        \
        -DPLUGIN_ARCHIVE=STATIC \
        -DPLUGIN_BLACKHOLE=STATIC \
        -DPLUGIN_CSV=STATIC \
        -DPLUGIN_HEAP=STATIC \
        -DPLUGIN_MYISAM=STATIC \
        -DPLUGIN_MYISAMMRG=STATIC \
        -DPLUGIN_SEQUENCE=STATIC \
        \
        -DPLUGIN_INNODB=NO \
        -DPLUGIN_INNOBASE=NO \
        -DPLUGIN_MROONGA=NO \
        -DPLUGIN_TOKUDB=NO \
        -DPLUGIN_ROCKSDB=NO \
        -DPLUGIN_SPIDER=NO \
        -DPLUGIN_SPHINX=NO \
        -DPLUGIN_CONNECT=NO \
        -DPLUGIN_PERFSCHEMA=NO \
        -DPLUGIN_COLUMNSTORE=NO \
        -DPLUGIN_OQGRAPH=NO \
        -DPLUGIN_FEDERATED=NO \
        -DPLUGIN_FEDERATEDX=NO \
        -DPLUGIN_AUTH_GSSAPI=NO \
        -DPLUGIN_AUTH_PAM=NO \
        -DPLUGIN_MARIA=NO \
        \
        -DCMAKE_C_FLAGS="-O2 -DHAVE_DLERROR -Wno-implicit-function-declaration -I$WASM_BUILD_DIR/extra/pcre2/src/pcre2-build/interface" \
        -DCMAKE_CXX_FLAGS="-O2 -DHAVE_DLERROR -I$WASM_BUILD_DIR/extra/pcre2/src/pcre2-build/interface" \
        -DCMAKE_EXE_LINKER_FLAGS="-sNODERAWFS=1" \
        2>&1 | tail -30

    # Build the embedded server library
    emmake make -j"$PARALLEL_JOBS" mysqlserver 2>&1 | tail -20

    echo ">>> Stage 2 complete."
    echo ""
}

# ---------------------------------------------------------------------------
# Stage 3: Link the WASM module
# ---------------------------------------------------------------------------
# Take the static libraries produced by Stage 2 and link them into a single
# .wasm + .js file using emcc. We expose the mysql_* C API functions so
# JavaScript can call them. The module uses MEMFS (Emscripten's in-memory
# filesystem) to store any data files that MyISAM or the server internals
# create at runtime.
# ---------------------------------------------------------------------------

link_wasm() {
    echo ">>> Stage 3: Linking WASM module..."
    mkdir -p "$OUTPUT_DIR"

    # Find the embedded server archive
    LIBMYSQLD=$(find "$WASM_BUILD_DIR" -name "libmysqld.a" -o -name "libmariadbd.a" | head -1)
    if [ -z "$LIBMYSQLD" ]; then
        # Try the combined server library
        LIBMYSQLD=$(find "$WASM_BUILD_DIR" -name "libmysqlserver.a" -o -name "libmariadbserver.a" | head -1)
    fi

    if [ -z "$LIBMYSQLD" ]; then
        echo "Error: Could not find embedded server library"
        echo "Available .a files:"
        find "$WASM_BUILD_DIR" -name "*.a" | head -20
        exit 1
    fi

    echo "Using library: $LIBMYSQLD"

    # Collect all static libraries that make up the embedded server
    LIBS=$(find "$WASM_BUILD_DIR" -name "*.a" | grep -v CMakeFiles | sort)

    emcc \
        -O2 \
        -sALLOW_MEMORY_GROWTH=1 \
        -sINITIAL_MEMORY=67108864 \
        -sSTACK_SIZE=1048576 \
        -sMODULARIZE=1 \
        -sEXPORT_NAME=createMariaDB \
        -sEXPORTED_FUNCTIONS='[
            "_mysql_server_init",
            "_mysql_server_end",
            "_mysql_init",
            "_mysql_real_connect",
            "_mysql_close",
            "_mysql_query",
            "_mysql_store_result",
            "_mysql_fetch_row",
            "_mysql_num_fields",
            "_mysql_num_rows",
            "_mysql_free_result",
            "_mysql_error",
            "_mysql_errno",
            "_mysql_affected_rows",
            "_mysql_field_count",
            "_mysql_fetch_field",
            "_mysql_fetch_lengths",
            "_mysql_real_escape_string",
            "_mysql_select_db",
            "_mysql_info",
            "_mysql_get_server_info",
            "_mysql_insert_id",
            "_malloc",
            "_free"
        ]' \
        -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","allocateUTF8","getValue","FS","NODEFS"]' \
        -lnodefs.js \
        -sERROR_ON_UNDEFINED_SYMBOLS=0 \
        -sFILESYSTEM=1 \
        -sEXIT_RUNTIME=0 \
        -sWASM_BIGINT=1 \
        -sENVIRONMENT='web,node' \
        --no-entry \
        $LIBS \
        -o "$OUTPUT_DIR/mariadb.js"

    echo ""
    echo ">>> Build complete!"
    echo ""
    ls -lh "$OUTPUT_DIR"/mariadb.*
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-all}" in
    host)
        build_host
        ;;
    wasm)
        build_wasm
        ;;
    link)
        link_wasm
        ;;
    all)
        build_host
        build_wasm
        link_wasm
        ;;
    clean)
        echo "Removing build directories..."
        rm -rf "$HOST_BUILD_DIR" "$WASM_BUILD_DIR" "$OUTPUT_DIR"
        echo "Clean."
        ;;
    *)
        echo "Usage: $0 [host|wasm|link|all|clean]"
        echo ""
        echo "  host   — Build native helper executables only"
        echo "  wasm   — Cross-compile MariaDB to WASM only"
        echo "  link   — Link the final .wasm module only"
        echo "  all    — Run all stages (default)"
        echo "  clean  — Remove all build artifacts"
        exit 1
        ;;
esac
