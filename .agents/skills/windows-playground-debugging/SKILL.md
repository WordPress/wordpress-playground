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

Test and debug WordPress Playground on Windows using Parallels Desktop (`prlctl exec`)
from macOS.

## Placeholders

Use placeholders instead of hardcoded local names:

- `<VM_NAME>`: Windows VM name from `prlctl list -a`.
- `<SHARE_NAME>`: Parallels host shared folder name for the checkout under test.
- `<REPO_UNC>`: Windows UNC path for the shared checkout, usually `\\Mac\<SHARE_NAME>`.
- `<DRIVE>`: Temporary Windows drive letter for source workflows, such as `U:`.

If any value is unclear, discover it with the commands below or ask the user.

## Prerequisites

- Parallels Desktop Pro or Business Edition. Standard lacks `prlctl exec`.
- Windows VM with Parallels Tools installed.
- Node.js 22+ installed in the VM for source workflows. Published CLI testing can use
  the current supported CLI Node.js version, but Node.js 22+ is a simple default.

## Minimal Setup

Discover the VM name and confirm the VM is usable:

```bash
prlctl list -a
prlctl list -i "<VM_NAME>"
"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl" info --license
```

Confirm the Windows CPU architecture and install Node.js for that architecture if needed:

```bash
prlctl exec "<VM_NAME>" cmd /c "echo %PROCESSOR_ARCHITECTURE%"
prlctl exec "<VM_NAME>" cmd /c "node --version && npm --version && npx --version"
```

`prlctl exec` runs as SYSTEM. Create SYSTEM's npm directory if it is missing:

```bash
prlctl exec "<VM_NAME>" cmd /c "if not exist C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm mkdir C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm"
```

Share the exact macOS checkout under test. If using an agent or worktree tool, verify
the share points to that exact worktree, not another clone. If needed, create a share
from the macOS checkout directory:

```bash
prlctl set "<VM_NAME>" --shf-host-add <SHARE_NAME> --path "$(pwd)" --mode rw --enable
```

Verify Windows can read the checkout. In macOS shell strings, escape UNC paths with
double backslashes:

```bash
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

Before testing a macOS change in Windows, run an exact-checkout smoke test:

```bash
mkdir -p .context
printf "%s\n" "$(pwd)" > .context/windows-share-smoke.txt
prlctl exec "<VM_NAME>" cmd /c "type \\\\Mac\\<SHARE_NAME>\\.context\\windows-share-smoke.txt"
```

For source workflows, use a mapped drive instead of a UNC working directory. `cmd.exe`
falls back to `C:\Windows` when started in a UNC path. Do not reuse macOS `node_modules`
for source workflows; install dependencies from Windows on the checkout under test.

## Core Command Pattern

All commands run from macOS and execute inside the Windows VM:

```bash
prlctl exec "<VM_NAME>" cmd /c "command here"
prlctl exec "<VM_NAME>" powershell -NoProfile -Command "script here"
```

Commands run as SYSTEM, which has symlink privileges but does not inherit user drive
mappings or npm profile directories. Avoid complex inline PowerShell through
`prlctl exec`; put complex commands in a temporary `.cmd` or `.ps1` file under a
gitignored directory such as `.context/windows-debug/`, then invoke that file from
Windows.

## Accessing macOS Files from Windows

Discover existing shares:

```bash
prlctl list -i "<VM_NAME>"
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac"
prlctl exec "<VM_NAME>" cmd /c "net use"
```

If a suitable share already exists, use its name as `<SHARE_NAME>`. If not, create one
with `prlctl set ... --shf-host-add` as shown above. When a share name is unavailable or
ambiguous, ask the user which macOS checkout should be tested.

If a mapped drive is listed by `net use` but later `dir <DRIVE>\` fails, map the drive
inside the same command or use the UNC path directly:

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && dir <DRIVE>\\package.json"
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

Network drives are SMB shares. Symlinks do not work there, and Nx may still fail even
with the network-drive environment variables below.

## Debugging Path

### 1. Run Published CLI Baseline

Use the published CLI first to separate VM, Node.js, networking, and WordPress runtime
issues from source-checkout issues:

```bash
prlctl exec "<VM_NAME>" cmd /c "\"C:\Program Files\nodejs\npx.cmd\" -y @wp-playground/cli@latest server --wp=6.8 --php=8.4 --port=9400"
```

Server at `http://127.0.0.1:9400` inside the VM. Verify from inside Windows:

```bash
prlctl exec "<VM_NAME>" powershell -NoProfile -Command "\$response = Invoke-WebRequest -Uri 'http://127.0.0.1:9400' -UseBasicParsing -TimeoutSec 20; Write-Host ('Status=' + \$response.StatusCode); Write-Host ('Length=' + \$response.Content.Length)"
```

### 2. Run Source CLI Directly Through Node

Use this before Nx when debugging startup. Requires Node.js 22+, initialized submodules,
and a Windows-side dependency install. On network shares, use
`npm ci --install-links` or `npm install --install-links`.

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && cd /d <DRIVE>\ && \"C:\Program Files\nodejs\node.exe\" --experimental-strip-types --experimental-transform-types --disable-warning=ExperimentalWarning --import ./packages/meta/src/node-es-module-loader/register.mts ./packages/playground/cli/src/cli.ts server --wp=6.8 --php=8.4 --port=9400"
```

For a temporary `.cmd` file, use the easier-to-read multiline command:

```cmd
cd /d <DRIVE>\
node --experimental-strip-types --experimental-transform-types ^
  --disable-warning=ExperimentalWarning ^
  --import ./packages/meta/src/node-es-module-loader/register.mts ^
  ./packages/playground/cli/src/cli.ts server --wp=6.8 --php=8.4 --port=9400
```

### 3. Run Source CLI Through Nx

Only use Nx after confirming it can see the workspace from Windows:

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && cd /d <DRIVE>\ && set \"NX_WORKSPACE_ROOT_PATH=<DRIVE>\\\" && set \"NX_DAEMON=false\" && call \"C:\Program Files\nodejs\npx.cmd\" nx show projects --json"
```

If Nx returns no projects or says the workspace root does not exist, use the direct Node
workflow above or copy the repo to a Windows-local NTFS path and install dependencies
there.

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && cd /d <DRIVE>\ && set \"NX_WORKSPACE_ROOT_PATH=<DRIVE>\\\" && set \"NX_DAEMON=false\" && call \"C:\Program Files\nodejs\npx.cmd\" nx run playground-cli:dev -- server --wp=6.8 --php=8.4 --port=9400"
```

### 4. Build From Source

Prefer a Windows-local NTFS checkout for full builds. If using a shared checkout, first
verify `nx show projects --json` works as shown above. Detailed prerequisites for Git
Bash, Visual C++ Redistributable, native packages, and symlinks live in
[references/details.md](references/details.md).

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && cd /d <DRIVE>\ && set \"NX_WORKSPACE_ROOT_PATH=<DRIVE>\\\" && set \"NX_DAEMON=false\" && set \"ComSpec=C:\Program Files\Git\bin\bash.exe\" && set \"PATH=C:\Program Files\Git\usr\bin;%PATH%\" && call \"C:\Program Files\nodejs\npx.cmd\" nx run-many --all --target=build"
```

### 5. Run Tests

Use Nx for tests after `nx show projects --json` works. If testing a package directly is
part of the debugging, keep the command scoped to the package under investigation.

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && cd /d <DRIVE>\ && set \"NX_WORKSPACE_ROOT_PATH=<DRIVE>\\\" && set \"NX_DAEMON=false\" && call \"C:\Program Files\nodejs\npx.cmd\" nx test <package-name> --testFile=<test-file-name>"
```

## Cleanup

After server tests, stop the captured server PID or clear stale Node processes:

```bash
prlctl exec "<VM_NAME>" cmd /c "taskkill /F /IM node.exe /T"
```

## Critical Environment Variables

| Variable                 | Value                                   | Purpose                                              |
| ------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `NX_WORKSPACE_ROOT_PATH` | Mapped drive root, e.g. `<DRIVE>\`      | Helps Nx resolve the workspace root on mapped drives |
| `NX_DAEMON`              | `false`                                 | Disables the Nx daemon on network drives             |
| `ComSpec`                | `C:\Program Files\Git\bin\bash.exe`     | Uses bash for Unix commands                          |
| `PATH`                   | Prepend `C:\Program Files\Git\usr\bin;` | Makes Unix utilities available                       |

## Common Issues Quick Reference

For detailed troubleshooting, setup instructions, and Windows-specific implementation
details, see [references/details.md](references/details.md).

| Problem                                   | Cause                                         | Fix                                                                                                |
| ----------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `prlctl exec` unavailable                 | Standard edition license                      | Upgrade to Pro/Business                                                                            |
| ENOENT for npm                            | SYSTEM user missing npm dir                   | Create `C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm`                              |
| `--experimental-strip-types` error        | Node.js < 22                                  | Install Node.js 22+                                                                                |
| Missing isomorphic-git module             | Submodule not initialized                     | `git submodule update --init --recursive` from macOS                                               |
| Windows cannot see edits                  | Share points at another checkout              | Run the `.context/windows-share-smoke.txt` test                                                    |
| Symlinks fail on network drive            | Windows/SMB limitation                        | Use local NTFS for symlink-sensitive workflows                                                     |
| MSYS path conversion                      | Git Bash path mangling                        | Set `MSYS_NO_PATHCONV=1` and `MSYS2_ARG_CONV_EXCL='*'`                                             |
| Nx cannot detect workspace                | Network drive issue                           | Set `NX_WORKSPACE_ROOT_PATH`, set `NX_DAEMON=false`, verify `nx show projects --json`              |
| `npm install` symlink failures            | Network drive limitation                      | Use `npm install --install-links`                                                                  |
| Native npm install fails on Windows ARM64 | Missing prebuild for packages such as `sharp` | Use native build tools for full builds/tests; `--ignore-scripts` only for profiling-only workflows |
| Port 9400 in use                          | Previous node still running                   | `taskkill /F /IM node.exe /T`                                                                      |
