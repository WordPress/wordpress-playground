#!/usr/bin/env python3

import os
from packaging import version

PHP_VERSION = version.parse(os.environ.get('PHP_VERSION', '7.4'))
WITH_LIBZIP = os.environ.get('WITH_LIBZIP', 'yes') == 'yes'
WITH_CLI_SAPI = os.environ.get('WITH_CLI_SAPI', 'no') == 'yes'
WITH_LIBXML = os.environ.get('WITH_LIBXML', 'no') == 'yes'
WITH_SQLITE = os.environ.get('WITH_SQLITE', 'no') == 'yes'
WITH_LIBPNG = os.environ.get('WITH_LIBPNG', 'no') == 'yes'
WITH_OPENSSL = os.environ.get('WITH_OPENSSL', 'no') == 'yes'
WITH_MBSTRING = os.environ.get('WITH_MBSTRING', 'no') == 'yes'
WITH_MYSQL = os.environ.get('WITH_MYSQL', 'no') == 'yes'
WITH_WS_NETWORKING_PROXY = os.environ.get(
    'WITH_WS_NETWORKING_PROXY', 'no') == 'yes'

php_configure_flags = []
emcc_php_wasm_flags = []
emcc_php_wasm_sources = []
exported_functions = [
    "_php_wasm_init", 
    "_phpwasm_destroy_uploaded_files_hash", 
    "_phpwasm_init_uploaded_files_hash", 
    "_phpwasm_register_uploaded_file", 
    "_wasm_set_phpini_path", 
    "_wasm_set_phpini_entries", 
    "_wasm_add_SERVER_entry", 
    "_wasm_add_uploaded_file", 
    "_wasm_sapi_handle_request", 
    "_wasm_set_content_length", 
    "_wasm_set_content_type", 
    "_wasm_set_cookies", 
    "_wasm_set_path_translated", 
    "_wasm_set_php_code", 
    "_wasm_set_query_string", 
    "_wasm_set_request_body", 
    "_wasm_set_request_host", 
    "_wasm_set_request_method", 
    "_wasm_set_request_port", 
    "_wasm_set_request_uri", 
    "_wasm_set_skip_shebang"
]

if WITH_LIBZIP:
    if PHP_VERSION < version.Version("7.4"):
        php_configure_flags.extend(
            ['--with-zlib', '--with-zlib-dir=/root/lib', '--enable-zip', '--with-libzip=/root/lib'])
        emcc_php_wasm_flags.extend(['-I', '/root/zlib', '-I', '/root/libzip'])
        emcc_php_wasm_sources.extend(
            ['/root/lib/lib/libzip.a', '/root/lib/lib/libz.a'])
    else:
        php_configure_flags.extend(
            ['--with-zlib', '--with-zlib-dir=/root/lib', '--with-zip'])
        emcc_php_wasm_flags.extend(['-I', '/root/zlib', '-I', '/root/libzip'])
        emcc_php_wasm_sources.extend(
            ['/root/lib/lib/libzip.a', '/root/lib/lib/libz.a'])

if WITH_CLI_SAPI:
    php_configure_flags.extend(['--enable-phar', '--enable-cli=static',
                                '--enable-readline', '--with-libedit=/root/lib'])
    emcc_php_wasm_sources.extend(['sapi/cli/php_cli_process_title.c', 'sapi/cli/ps_title.c',
                                  'sapi/cli/php_http_parser.c', 'sapi/cli/php_cli_server.c', 'sapi/cli/php_cli.c'])
    exported_functions.extend(['"_run_cli"', '"_wasm_add_cli_arg"'])
    emcc_php_wasm_flags.extend(['-DWITH_CLI_SAPI=1', '-lncurses', '-ledit'])
else:
    php_configure_flags.append('--disable-cli')

if WITH_LIBXML:
    php_configure_flags.extend(['--enable-libxml', '--with-libxml', '--with-libxml-dir=/root/lib',
                                '--enable-dom', '--enable-xml', '--enable-simplexml', '--enable-xmlreader', '--enable-xmlwriter'])
    emcc_php_wasm_flags.extend(['-I', '/root/libxml2', '-lxml2'])
    emcc_php_wasm_sources.append('/root/lib/lib/libxml2.a')
else:
    php_configure_flags.extend(['--disable-libxml', '--without-libxml', '--disable-dom',
                                '--disable-xml', '--disable-simplexml', '--disable-xmlwriter'])

if WITH_SQLITE:
    php_configure_flags.extend(
        ['--with-sqlite3', '--enable-pdo', '--with-pdo-sqlite=/root/lib'])
    emcc_php_wasm_flags.append('-I')
    emcc_php_wasm_flags.append('ext/pdo_sqlite')
    if PHP_VERSION >= version.Version("7.4"):
        emcc_php_wasm_flags.append('-lsqlite3')

if WITH_LIBPNG:
    php_configure_flags.extend(
        ['--with-png-dir=/root/lib', '--with-gd', '--enable-gd'])
    emcc_php_wasm_flags.extend(
        ['-I', '/root/zlib', '-I', '/root/libpng16', '-lz', '-lpng16'])

if WITH_OPENSSL:
    php_configure_flags.extend(
        ['--with-openssl', '--with-openssl-dir=/root/lib'])
    emcc_php_wasm_flags.extend(['-lssl', '-lcrypto'])

if WITH_MBSTRING:
    php_configure_flags.append('--enable-mbstring')
else:
    php_configure_flags.append('--disable-mbstring')

if WITH_MYSQL:
    php_configure_flags.extend(['--enable-mysql', '--enable-pdo', '--with-mysql=mysqlnd',
                                '--with-mysqli=mysqlnd', '--with-pdo-mysql=mysqlnd'])

if os.environ.get('EMSCRIPTEN_ENVIRONMENT') == 'node':
    # Add nodefs when building for node.js
    emcc_php_wasm_flags.append('-lnodefs.js')
    # Preserve symbol names in node.js build – the bundle size doesn't matter as much
    # as on the web, and this makes debugging **much** easier.
    emcc_php_wasm_flags.append('-g2')

def to_quoted_list(strings):
    return ','.join(['"%s"' % s for s in strings])

def fns_to_emcc_option(name, fns):
    as_str = to_quoted_list(fns)
    return f'{name}=\'[{as_str}]\''

if WITH_WS_NETWORKING_PROXY:
    from asyncify import *
    emcc_php_wasm_flags.extend(
        ['-lwebsocket.js', '-s', 'ASYNCIFY=1', '-s', 'ASYNCIFY_IGNORE_INDIRECT=1']
    )

    ASYNCIFY_ONLY = ASYNCIFY_ONLY_UNPREFIXED + ASYNCIFY_ONLY_ALWAYS

    # PHP < 8.0 errors out with "null function or function signature mismatch"
    # unless EMULATE_FUNCTION_POINTER_CASTS is enabled. The error originates in
    # the rc_dtor_func which traces back to calling the zend_list_free function.
    # The signatures are the same on the face value, but the wasm runtime is not
    # happy somehow. This can probably be patched in PHP, but for now we just
    # enable the flag and pay the price of the additional overhead.
    # https://emscripten.org/docs/porting/guidelines/function_pointer_issues.html
    if PHP_VERSION < version.Version("8.0"):
        emcc_php_wasm_flags.extend(['-s', 'EMULATE_FUNCTION_POINTER_CASTS=1'])
        ASYNCIFY_ONLY.extend(ASYNCIFY_ONLY_PREFIXED)

    emcc_php_wasm_flags.extend(
        ['-s', fns_to_emcc_option("ASYNCIFY_ONLY", ASYNCIFY_ONLY)]
    )

with open('source/build_config.sh', 'w') as f:
    f.write(f'export PHP_CONFIGURE_FLAGS="{" ".join(php_configure_flags)}"\n')
    f.write(f'export EMCC_PHP_WASM_FLAGS="{" ".join(emcc_php_wasm_flags)}"\n')
    f.write(f'export EMCC_PHP_WASM_SOURCES="{to_quoted_list(emcc_php_wasm_sources)}"\n')
    f.write(f'export EXPORTED_FUNCTIONS=",{to_quoted_list(exported_functions)}"\n')
