# Emscripten OPFS experiment

This is an attempt to build an Emscripten module that uses
OPFS as its filesystem.

To try it out locally, run:

```bash
python server.py
```

Then, go to http://localhost:8000/ and open the developer tools.

## OPFS crashes in Chrome

No matter what I did, I couldn't get OPFS to work in the browser.

It always crashes when creating a new file in the `/opfs` directory. This function call:

```c
void create_file() {
    FILE *file = fopen("/opfs/test.txt", "w");
    // ...
}
```

Invokes the following asynchronous JavaScript implementation:

```js
  async function wasmfsOPFSGetOrCreateFile(parent, name, create) {
      let parentHandle = wasmfsOPFSDirectoryHandles.get(parent);
      let fileHandle;
      try {
        fileHandle = await parentHandle.getFileHandle(name, {create: create});
        // ...
```

However, the `await` is deadly and crashes the WASM process:

```
support.cpp:39 Uncaught RuntimeError: unreachable
    at wasmfs::handle_unreachable(char const*, char const*, unsigned int) (http://localhost:8000/opfs.wasm:wasm-function[327]:0xf3d3)
    at (anonymous namespace)::OPFSDirectory::getChild(std::__2::basic_string<char, std::__2::char_traits<char>, std::__2::allocator<char>> const&) (http://localhost:8000/opfs.wasm:wasm-function[297]:0xba0e)
    at wasmfs::Directory::Handle::getChild(std::__2::basic_string<char, std::__2::char_traits<char>, std::__2::allocator<char>> const&) (http://localhost:8000/opfs.wasm:wasm-function[406]:0x11c4c)
    at wasmfs::path::(anonymous namespace)::getChild(std::__2::shared_ptr<wasmfs::Directory>, std::__2::basic_string_view<char, std::__2::char_traits<char>>, wasmfs::path::LinkBehavior, unsigned long&) (http://localhost:8000/opfs.wasm:wasm-function[439]:0x17a2f)
    at wasmfs::path::(anonymous namespace)::doParseParent(std::__2::basic_string_view<char, std::__2::char_traits<char>>, std::__2::shared_ptr<wasmfs::Directory>, unsigned long&) (http://localhost:8000/opfs.wasm:wasm-function[438]:0x175f2)
    at wasmfs::path::parseParent(std::__2::basic_string_view<char, std::__2::char_traits<char>>, unsigned int) (http://localhost:8000/opfs.wasm:wasm-function[436]:0x16ef2)
    at __syscall_openat (http://localhost:8000/opfs.wasm:wasm-function[474]:0x1b10d)
    at open (http://localhost:8000/opfs.wasm:wasm-function[53]:0x15a8)
    at create_file (http://localhost:8000/opfs.wasm:wasm-function[47]:0x11e7)
    at ret.<computed> (http://localhost:8000/opfs.js:2559:35)
```

It's not about the `getFileHandle` call. It's about asynchronous code. The same function with `await sleep(100);` crashes in the exact same way.

## Potential solutions

I tried building:

-   With `-sASYNCIFY=1` and different ASYNCIFY settings and imports
-   With `-sASYNCIFY=2` (after enabling JSPI at chrome://flags)
-   With `-sWASM_WORKERS`

Unfortunately, the final bundle always crashes in the same way.

Weirdly, it crashes on file creation but not on directory creation. The `mkdir` code path seems to somehow support stack switching.

I don't have any futher ideas so I'll abandon these explorations for now and leave this PR for posterity.

## Implementation details

This PR explores Emscripten's new WASMFS filesystem with OPFS backend.

`main.c` contains the C code where the OPFS directory is created:

```c
int main() {
    backend_t opfs = wasmfs_create_opfs_backend();
    emscripten_console_log("created OPFS backend");
    wasmfs_create_directory("/opfs", 0777, opfs);
}

void create_file() {
    FILE *file = fopen("/opfs/test.txt", "w");
    // ...
}
```

It's then built into a WASM module via `build.sh` (or `build-in-docker.sh` for convenience) and loaded in the browser by index.html.

## Building

Run `build-in-docker.sh`

## WASMFS Resources

There's no documentation out there, I've been learning from GitHub discussions and code in the Emscripten repo. Here's a few useful links:

-   https://github.com/emscripten-core/emscripten/issues/15949
-   https://github.com/emscripten-core/emscripten/issues/15041
-   https://docs.google.com/document/d/1-ZxybGvz0nCqygUDuWxCcCBhCebev3EbUSYoSOlc49Q/edit#heading=h.xzptrog8pyxf
-   https://emscripten.org/docs/api_reference/Filesystem-API.html#new-file-system-wasmfs
-   https://github.com/emscripten-core/emscripten/blob/main/test/wasmfs/wasmfs_opfs.c
-   https://github.com/orgs/emscripten-core/projects/1/views/1?filterQuery=
-   https://github.com/emscripten-core/emscripten/pull/16813
-   https://github.com/emscripten-core/emscripten/issues/18112
-   https://github.com/emscripten-core/emscripten/blob/bb265ceb2e5340a9d5a08349522b94ea74aa9265/src/library_wasmfs_opfs.js
-   https://github.com/emscripten-core/emscripten/issues/15976
