# Running Playwright WebKit locally

The WebKit browser downloaded successfully with:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/playground-browsers npm exec -- playwright install webkit
```

Playwright's host validation reported these missing shared libraries in the current
Linux environment:

```text
libgtk-4.so.1
libgraphene-1.0.so.0
libgstallocators-1.0.so.0
libgstapp-1.0.so.0
libgstpbutils-1.0.so.0
libgstaudio-1.0.so.0
libgsttag-1.0.so.0
libgstvideo-1.0.so.0
libgstgl-1.0.so.0
libgstcodecparsers-1.0.so.0
libgstfft-1.0.so.0
libharfbuzz-icu.so.0
libmanette-0.2.so.0
libenchant-2.so.2
libhyphen.so.0
libsecret-1.so.0
libwoff2dec.so.1.0.2
libGLESv2.so.2
```

On a supported Linux distribution, Playwright can install its OS dependencies
using the system package manager (administrator access required):

```sh
npm exec -- playwright install-deps webkit
```

Then build and run the scoped-navigation tests:

```sh
npm exec -- nx run playground-website:build:wordpress-frame
PLAYWRIGHT_BROWSERS_PATH=/tmp/playground-browsers npm exec -- nx run playground-website:e2e:wordpress-frame --args='--project=webkit --grep="scoped navigation falls back|WordPress popups use" --retries=0'
```

The temporary browser location is specific to this environment. If you install
browsers in Playwright's default location, omit `PLAYWRIGHT_BROWSERS_PATH` when
installing and running. The library list above describes this Linux host; macOS
uses a different WebKit distribution. Physical Safari/iOS testing is still needed.
