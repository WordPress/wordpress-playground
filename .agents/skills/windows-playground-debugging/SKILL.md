---
name: windows-playground-debugging
description: >
  Guide for testing and debugging WordPress Playground on Windows using Parallels Desktop from macOS.
  Use when: running Playground CLI on Windows, building Playground from source on Windows,
  running tests on Windows via prlctl, debugging Windows-specific issues (symlinks, network drives,
  path conversion), or setting up Node.js in a Windows VM.
  Triggers on mentions of Parallels, prlctl, Windows VM, Windows debugging,
  or cross-platform Playground testing.
---

# Windows Playground Debugging

Test and debug WordPress Playground on Windows using Parallels Desktop (`prlctl exec`) from macOS.

## Prerequisites

- **Parallels Desktop Pro or Business Edition** (Standard lacks `prlctl exec`)
- Windows VM with Parallels Tools installed
- Node.js installed in the VM (v20.18.3+ for CLI, v22+ for dev CLI)

## Core Command Pattern

All commands follow this pattern — run from macOS, execute inside Windows VM:

```bash
prlctl exec "Windows 11 (1)" cmd /c "command here"
# Or for complex operations:
prlctl exec "Windows 11 (1)" powershell -Command "script here"
```

Replace `Windows 11 (1)` with the VM name from `prlctl list -a`.

Commands run as SYSTEM user, which has symlink privileges but lacks user drive mappings and npm directories.

## Accessing macOS Files from Windows

Parallels shares macOS directories as network paths (`\\Mac\<folder>`). First confirm the
repo is available as a shared folder:

```bash
prlctl exec "Windows 11 (1)" cmd /c "dir \\Mac"
```

If the repo is not listed, enable or add a host shared folder in Parallels before mapping
it. To use an available share in Windows, map a drive letter:

```bash
prlctl exec "Windows 11 (1)" cmd /c "net use Z: \"\\\\Mac\\wordpress-playground\" /persistent:yes"
```

This makes the macOS `wordpress-playground` repo available as `Z:\` inside Windows. Replace
`\\Mac\wordpress-playground` with the actual shared-folder name. The drive letter is
arbitrary — examples in this skill use `Z:\` but any letter works. The SYSTEM user (used
by `prlctl exec`) doesn't inherit user drive mappings, so this must be done explicitly.

**Important:** These are network drives (SMB shares), which means symlinks don't work and NX needs special configuration. See environment variables and common issues below.

To run a script from the repo inside Windows, reference it via the mapped drive:

```bash
# Run a script from the repo
prlctl exec "Windows 11 (1)" cmd /c "\"C:\\Program Files\\nodejs\\node.exe\" Z:\path\to\script.mjs"
```

## Key Workflows

### 1. Run Published CLI

```bash
prlctl exec "Windows 11 (1)" cmd /c "\"C:\\Program Files\\nodejs\\npx.cmd\" @wp-playground/cli server --wp=6.7 --php=8.2"
```

Server at `http://127.0.0.1:9400` inside the VM.

### 2. Run Dev CLI from Source

Requires Node.js 22+ (for `--experimental-strip-types`) and initialized isomorphic-git submodule (`git submodule update --init --recursive` from macOS).

```bash
prlctl exec "Windows 11 (1)" powershell -Command "
  cd Z:\;
  \$env:NX_WORKSPACE_ROOT_PATH = 'Z:\';
  \$env:NX_DAEMON = 'false';
  & 'C:\\Program Files\\nodejs\\npx.cmd' nx run playground-cli:dev -- server --wp=6.8 --php=8.4
"
```

To convert a published CLI command to dev CLI: replace `@wp-playground/cli@latest` with `nx run playground-cli:dev --`.

### 3. Build from Source

Requires VC++ Redistributable, Git for Windows, and environment setup for network drive issues.

```bash
prlctl exec "Windows 11 (1)" powershell -Command "
  cd Z:\;
  \$env:PATH = 'C:\\Program Files\\Git\\usr\\bin;' + \$env:PATH;
  \$env:NX_WORKSPACE_ROOT_PATH = 'Z:\';
  \$env:NX_DAEMON = 'false';
  \$env:ComSpec = 'C:\\Program Files\\Git\\bin\\bash.exe';
  & 'C:\\Program Files\\nodejs\\node.exe' node_modules\\nx\\bin\\nx.js run-many --all --target=build
"
```

### 4. Run Tests

```bash
prlctl exec "Windows 11 (1)" powershell -Command "
  cd Z:\packages\php-wasm\node;
  \$env:NX_WORKSPACE_ROOT_PATH = 'Z:\';
  \$env:NX_DAEMON = 'false';
  & 'C:\\Program Files\\nodejs\\npx.cmd' vitest run --config vite.config.ts src/test/symlinks.spec.ts
"
```

## Critical Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `NX_WORKSPACE_ROOT_PATH` | Mapped drive letter (e.g. `Z:\`) | Force NX workspace root on network drives |
| `NX_DAEMON` | `false` | Disable NX daemon (required for network drives) |
| `ComSpec` | `C:\Program Files\Git\bin\bash.exe` | Use bash for Unix commands (mkdir -p, cp, rm -rf) |
| `PATH` | Prepend `C:\Program Files\Git\usr\bin;` | Make Unix utilities available |

## Common Issues Quick Reference

For detailed troubleshooting, setup instructions, and Windows-specific implementation details, see [references/details.md](references/details.md).

| Problem | Cause | Fix |
|---------|-------|-----|
| `prlctl exec` unavailable | Standard edition license | Upgrade to Pro/Business |
| ENOENT for npm | SYSTEM user missing npm dir | `mkdir C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm` |
| `--experimental-strip-types` error | Node.js < 22 | Install Node.js 22+ |
| Missing isomorphic-git module | Submodule not initialized | `git submodule update --init --recursive` from macOS |
| Symlinks fail on network drive | Windows/SMB limitation | Tests auto-fallback to local temp dir |
| MSYS path conversion (`/wordpress` → `C:/Program Files/Git/wordpress`) | Git Bash path mangling | Set `MSYS_NO_PATHCONV=1` and `MSYS2_ARG_CONV_EXCL='*'` |
| NX can't detect workspace | Network drive issue | Set `NX_WORKSPACE_ROOT_PATH` |
| `npm install` symlink failures | Network drive limitation | Use `npm install --install-links` |
| NX WASM fallback fails | Network paths unsupported | `npm install @nx/nx-win32-x64-msvc` |
| Port 9400 in use | Previous node still running | `taskkill /IM node.exe /F` |

## Windows Symlink Behavior

- `'file'` symlinks: default type
- `'dir'` symlinks: require admin or Developer Mode
- `'junction'`: works without admin, but only on local NTFS drives
- SYSTEM user (via prlctl): has symlink privileges
- Network drives: symlinks unsupported — tests auto-copy to local temp dir
