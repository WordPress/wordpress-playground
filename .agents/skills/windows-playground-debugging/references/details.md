# Windows Playground Debugging — Detailed Reference

## VM Management

```bash
# List all VMs.
prlctl list -a

# Check VM details and Parallels Tools status.
prlctl list -i "<VM_NAME>"

# Check license edition. It must be Pro or Business for prlctl exec.
"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl" info --license
```

Full path to `prlctl`: `"/Applications/Parallels Desktop.app/Contents/MacOS/prlctl"`

Use the VM name from `prlctl list -a` in all `prlctl exec` commands.

## Setup Checklist

Use this minimal setup for testing Playground from macOS against a Windows VM:

```bash
# Discover the VM name and confirm Parallels Tools/license.
prlctl list -a
prlctl list -i "<VM_NAME>"
"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl" info --license

# Confirm the Windows CPU architecture.
prlctl exec "<VM_NAME>" cmd /c "echo %PROCESSOR_ARCHITECTURE%"

# Verify Node.js. If it is missing, install Node.js 22+ for the VM architecture.
prlctl exec "<VM_NAME>" cmd /c "node --version && npm --version && npx --version"

# prlctl exec runs as SYSTEM; create SYSTEM's npm directory if it is missing.
prlctl exec "<VM_NAME>" cmd /c "if not exist C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm mkdir C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm"

# Verify the shared checkout.
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

Expected:

- license edition is `pro` or `business`
- Parallels Tools are installed in the VM
- Node.js 22+ is available for source workflows
- the shared folder resolves to the exact macOS checkout under test

## Node.js Setup

Install Node.js 22+ inside the VM if `node --version` fails or if source workflows need
Node's type-stripping support. Choose the installer or package-manager command that
matches the VM architecture (`ARM64` vs `AMD64`/x64). Do not hardcode a download URL in
the skill; use the current official installer or the user's preferred Windows package
manager.

After installation, verify from the SYSTEM context used by `prlctl exec`:

```bash
prlctl exec "<VM_NAME>" cmd /c "\"C:\Program Files\nodejs\node.exe\" --version && \"C:\Program Files\nodejs\npx.cmd\" --version"
```

## Shared Folder Discovery

Check which macOS shares are visible inside Windows before mapping a drive letter:

```bash
prlctl list -i "<VM_NAME>"
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac"
prlctl exec "<VM_NAME>" cmd /c "net use"
```

If the repository is not visible, enable or add a host shared folder in Parallels first.
Shared Profile may expose only Desktop, Documents, and Downloads, which may not include
the checkout under test.

When using an agent or worktree tool, share that exact worktree path directly. A
similarly named share may point at a separate root checkout that does not include the
workspace branch or unmerged changes.

Generic setup:

```bash
prlctl set "<VM_NAME>" --shf-host-add <SHARE_NAME> --path "$(pwd)" --mode rw --enable
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

Before testing a macOS change in Windows, verify Windows sees the changed workspace. For
example, create or edit a temporary file on macOS under `.context/`, then read it from
Windows:

```bash
mkdir -p .context
printf "%s\n" "$(pwd)" > .context/windows-share-smoke.txt
prlctl exec "<VM_NAME>" cmd /c "type \\\\Mac\\<SHARE_NAME>\\.context\\windows-share-smoke.txt"
```

For source workflows, use a mapped drive instead of a UNC working directory. `cmd.exe`
falls back to `C:\Windows` when started in a UNC path. Do not reuse macOS `node_modules`
for source workflows; install dependencies from Windows on the checkout under test.

If a mapped drive is visible in `net use` but unavailable in a later command, remap it in
the same `prlctl exec` process or use the UNC path directly:

```bash
prlctl exec "<VM_NAME>" cmd /c "net use <DRIVE> \"\\\\Mac\\<SHARE_NAME>\" /persistent:no && dir <DRIVE>\\package.json"
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

## SYSTEM User Setup

`prlctl exec` runs as SYSTEM. One-time setup needed:

```bash
prlctl exec "<VM_NAME>" cmd /c "if not exist C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm mkdir C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm"
```

Always use full paths for executables when PATH is uncertain:

- Node: `"C:\Program Files\nodejs\node.exe"`
- npm: `"C:\Program Files\nodejs\npm.cmd"`
- npx: `"C:\Program Files\nodejs\npx.cmd"`

## Command Quoting

Avoid complex inline PowerShell through `prlctl exec`. Escaping quickly becomes the
debugging problem instead of the Windows issue under investigation. Prefer one of these:

1. Keep simple commands inline with `cmd /c`.
2. Put complex commands in a temporary `.cmd` or `.ps1` file under a gitignored
   directory such as `.context/windows-debug/`.
3. Invoke that script from Windows through the mapped drive or UNC share.

When using PowerShell directly inside Windows, `$` does not need escaping. When embedding
PowerShell in a macOS shell string, escape `$` as `\$`.

## Source CLI Without Nx

Use the direct Node entrypoint before Nx when debugging CLI startup. It removes Nx
workspace detection, daemon, and network-drive behavior from the first source baseline:

```cmd
cd /d <DRIVE>\
node --experimental-strip-types --experimental-transform-types ^
  --disable-warning=ExperimentalWarning ^
  --import ./packages/meta/src/node-es-module-loader/register.mts ^
  ./packages/playground/cli/src/cli.ts server --wp=6.8 --php=8.4 --port=9400
```

## Build Prerequisites

### Visual C++ Redistributable

Use the redistributable that matches the VM architecture. Ask the user before installing
system components if it is not clear whether they are already present.

### Windows ARM64 npm Caveat

`npm ci --install-links` can still fail on native packages, such as `sharp`, when no
Node.js, Windows, and ARM64 prebuild exists for the requested package version. For
profiling-only workflows where dependency postinstall output is not needed,
`npm install --install-links --ignore-scripts` may be enough. For full builds and tests,
install Python and native Windows build tooling for the VM architecture instead of
masking postinstall failures.

### Network Drive Build Issues

1. Symlinks: use `npm install --install-links`.
2. Nx native package: install the matching package for the VM architecture if Nx falls
   back to unsupported WASM behavior.
3. Workspace detection: set `NX_WORKSPACE_ROOT_PATH` to the mapped drive root and
   `NX_DAEMON=false`, then verify with `nx show projects --json`.
4. If Nx returns no projects or says the workspace root does not exist, use the direct
   Node CLI workflow or copy the repo to Windows-local NTFS.
5. Unix commands: install Git for Windows and set `ComSpec`/`PATH` as needed.

## Verifying the Server

```bash
prlctl exec "<VM_NAME>" powershell -NoProfile -Command "
  \$response = Invoke-WebRequest -Uri 'http://127.0.0.1:9400' -UseBasicParsing -TimeoutSec 10;
  Write-Host 'Status:' \$response.StatusCode;
  Write-Host 'Size:' \$response.Content.Length 'bytes';
"
```

After server tests, kill the captured PID if you started one explicitly. If not, clear
stale Node processes before reusing the same port:

```bash
prlctl exec "<VM_NAME>" cmd /c "taskkill /F /IM node.exe /T"
```

## Symlink Test Behavior Matrix

| Environment           | Symlink Location        | Behavior                                    |
| --------------------- | ----------------------- | ------------------------------------------- |
| macOS                 | Local filesystem        | Works normally                              |
| Windows local drive   | `C:\` or similar        | Works with Developer Mode, admin, or SYSTEM |
| Windows network drive | Parallels shared folder | Symlinks unsupported; copy to local temp    |
| Windows via `prlctl`  | Local NTFS drive        | SYSTEM has symlink privileges               |

Symlink permissions on Windows require one of: Administrator privileges, Developer Mode
enabled, or SYSTEM user via `prlctl`.

## Running Tests Directly in Windows PowerShell

When running directly in PowerShell, syntax differs slightly because `$` does not need
escaping:

```powershell
cd <DRIVE>\packages\php-wasm\node
$env:NX_WORKSPACE_ROOT_PATH = '<DRIVE>\'
$env:NX_DAEMON = 'false'
& 'C:\Program Files\nodejs\npx.cmd' vitest run --config vite.config.ts src/test/symlinks.spec.ts
```

The `&` operator before the path is required to execute the command.
