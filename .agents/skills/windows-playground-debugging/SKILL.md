---
name: windows-playground-debugging
description: >
    Guide for testing and debugging WordPress Playground on Windows hosts, Windows VMs,
    or remote Windows shells. Use when running Playground CLI, builds, or tests on
    Windows; debugging Windows-specific path, symlink, network-share, Node.js, npm,
    or Nx issues; or working with Windows through Hyper-V, VMware, VirtualBox, UTM,
    Parallels, RDP, SSH, WinRM, PowerShell, cmd, prlctl, vmrun, or VBoxManage.
---

# Windows Playground Debugging

Use this skill to reproduce, isolate, and debug WordPress Playground behavior on
Windows. Do not assume the user has Parallels, a Mac host, or VM automation. First
identify how Windows is accessible, then run the same Windows-side workflow through
that access method.

## Access Modes

Pick the lowest-friction mode available:

- **Native Windows host**: run commands directly in PowerShell or `cmd`.
- **Windows VM with interactive access**: run commands in the VM terminal, RDP, or the
  VM console.
- **Remote Windows shell**: run commands through SSH, WinRM, PowerShell Remoting, or
  another configured remote shell.
- **Host-controlled VM**: wrap the Windows commands with the VM provider's guest-exec
  tool. Parallels `prlctl exec` is one adapter, not a requirement.

If only interactive access is available, give the user a small command block to run and
ask for the output. If an automation adapter is available, keep the Windows command
identical and only swap the outer wrapper.

## Placeholders

- `<REPO>`: Windows path to the checkout under test. Prefer a Windows-local NTFS path
  such as `C:\src\wordpress-playground` for installs, builds, and tests.
- `<HOST_SHARE>`: optional host shared-folder UNC path, such as `\\Mac\<share>`,
  `\\vmware-host\Shared Folders\<share>`, `\\VBOXSVR\<share>`, or another provider path.
- `<DRIVE>`: temporary mapped drive for a shared checkout, such as `U:`.
- `<PORT>`: local port for Playground CLI server tests, such as `9400`.
- `<SHARE_NAME>`: name for a provider shared folder created for the checkout, such as
  `playground`.
- `<VM_NAME>` and `<WIN_HOST>`: VM or remote host identifiers, only if needed.

## Core Rule

Separate Windows-specific behavior from host/VM plumbing:

1. Verify Windows, Node.js, npm, git, and the exact checkout.
2. Run a published CLI baseline.
3. Run the source CLI directly with Node.
4. Use Nx only after workspace detection works.
5. Move from quick smoke tests to package tests or full builds.

For full installs, builds, symlink tests, and Nx-heavy workflows, prefer a
Windows-local NTFS checkout. Shared folders are useful for quick smoke tests and for
verifying a host change, but they can break symlinks, npm linking, file watching, and
Nx workspace detection.

## Command Surfaces

PowerShell, direct on Windows:

```powershell
Set-Location '<REPO>'
node --version
npm --version
```

`cmd`, direct on Windows:

```cmd
cd /d <REPO>
node --version && npm --version
```

Remote shell example:

```bash
ssh <WIN_HOST> 'powershell -NoProfile -Command "Set-Location ''<REPO>''; node --version; npm --version"'
```

Host-controlled VM example using Parallels:

```bash
prlctl exec "<VM_NAME>" powershell -NoProfile -Command "Set-Location '<REPO>'; node --version; npm --version"
```

For other VM providers, use their guest command runner if available, or fall back to
RDP/console/SSH. Keep complex commands in a temporary `.cmd` or `.ps1` file under a
gitignored directory such as `.context/windows-debug/`, then invoke that script from
Windows. See [references/details.md](references/details.md) for provider notes.

## Minimal Environment Check

Run this from Windows:

```powershell
[System.Environment]::OSVersion.VersionString
$env:PROCESSOR_ARCHITECTURE
node --version
npm --version
npx --version
git --version
```

Use the Node.js version from `.nvmrc`. Source CLI workflows need a Node.js version that
supports the repo's type-stripping setup.

## Verify the Checkout

For a Windows-local checkout:

```powershell
Set-Location '<REPO>'
git rev-parse --show-toplevel
git status --short
Test-Path package.json
Test-Path nx.json
```

From a fresh checkout or worktree, install dependencies before builds or tests:

```powershell
npm ci
```

For a host shared-folder checkout, prove Windows is reading the exact worktree under
test. From the host checkout, write a marker:

```bash
mkdir -p .context
printf "%s\n" "$(pwd)" > .context/windows-share-smoke.txt
```

Then read it from Windows:

```powershell
Get-Content '<HOST_SHARE>\.context\windows-share-smoke.txt'
Test-Path '<HOST_SHARE>\package.json'
```

If using `cmd`, map the share inside the same command session because UNC working
directories are unreliable:

```cmd
net use <DRIVE> "<HOST_SHARE>" /persistent:no
cd /d <DRIVE>\
dir package.json
```

On network shares, try `npm ci --install-links` or `npm install --install-links`. If
symlinks, postinstall scripts, or Nx still fail, copy the repo to a Windows-local NTFS
path and install dependencies there.

## Debugging Ladder

### 1. Published CLI Baseline

Use the published CLI first to separate Windows, Node.js, networking, and WordPress
runtime issues from source-checkout issues:

```powershell
npx -y @wp-playground/cli@latest server --wp=6.8 --php=8.4 --port=<PORT>
```

Verify from another Windows shell:

```powershell
$response = Invoke-WebRequest -Uri 'http://127.0.0.1:<PORT>' -UseBasicParsing -TimeoutSec 20
'Status=' + $response.StatusCode
'Length=' + $response.Content.Length
```

Inside a VM, `127.0.0.1` is the VM loopback. To test from the host, use the VM IP,
configured port forwarding, or the VM provider's networking controls.

### 2. Source CLI Directly Through Node

Use this before Nx when debugging startup:

```powershell
Set-Location '<REPO>'
node --experimental-strip-types --experimental-transform-types `
  --disable-warning=ExperimentalWarning `
  --import ./packages/meta/src/node-es-module-loader/register.mts `
  ./packages/playground/cli/src/cli.ts server --wp=6.8 --php=8.4 --port=<PORT>
```

Equivalent `cmd` form:

```cmd
cd /d <REPO>
node --experimental-strip-types --experimental-transform-types ^
  --disable-warning=ExperimentalWarning ^
  --import ./packages/meta/src/node-es-module-loader/register.mts ^
  ./packages/playground/cli/src/cli.ts server --wp=6.8 --php=8.4 --port=<PORT>
```

### 3. Nx Workspace Detection

Use Nx only after it can see the workspace:

```powershell
Set-Location '<REPO>'
$env:NX_DAEMON = 'false'
npm exec nx -- show projects --json
```

For mapped network drives, also set `NX_WORKSPACE_ROOT_PATH`:

```powershell
$env:NX_WORKSPACE_ROOT_PATH = '<DRIVE>\'
$env:NX_DAEMON = 'false'
npm exec nx -- show projects --json
```

If Nx returns no projects or says the workspace root does not exist, use the direct
Node workflow above or move the checkout to local NTFS.

### 4. Source CLI Through Nx

```powershell
Set-Location '<REPO>'
$env:NX_DAEMON = 'false'
npm exec nx -- run playground-cli:dev -- server --wp=6.8 --php=8.4 --port=<PORT>
```

### 5. Package Tests

Keep tests scoped to the package or file under investigation:

```powershell
Set-Location '<REPO>'
$env:NX_DAEMON = 'false'
npm exec nx -- test <package-name> --testFile=<test-file-name>
```

### 6. Builds

Prefer Windows-local NTFS for full builds:

```powershell
Set-Location '<REPO>'
$env:NX_DAEMON = 'false'
npm exec nx -- run-many --all --target=build
```

If build scripts require Unix tools, install Git for Windows and prepend its Unix tools
directory only for that command session:

```powershell
$env:ComSpec = 'C:\Program Files\Git\bin\bash.exe'
$env:PATH = 'C:\Program Files\Git\usr\bin;' + $env:PATH
```

## Cleanup

Stop the CLI server with `Ctrl+C` when it runs in an interactive shell. If the shell is
gone, stop only the process that owns the server port:

```powershell
Get-NetTCPConnection -LocalPort <PORT> -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Killing every Node.js process is acceptable only on a VM dedicated to debugging. Never
do this on a native host or shared machine, where it would stop unrelated tools:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Equivalent `cmd` form for a dedicated VM:

```cmd
taskkill /F /IM node.exe /T
```

## Critical Environment Variables

| Variable                 | Value                                   | Purpose                                              |
| ------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `NX_DAEMON`              | `false`                                 | Avoids daemon problems on VMs and network drives     |
| `NX_WORKSPACE_ROOT_PATH` | Mapped drive root, e.g. `<DRIVE>\`      | Helps Nx resolve the workspace root on mapped drives |
| `ComSpec`                | `C:\Program Files\Git\bin\bash.exe`     | Uses Git Bash when build scripts need Unix commands  |
| `PATH`                   | Prepend `C:\Program Files\Git\usr\bin;` | Makes Unix utilities available for the session       |
| `MSYS_NO_PATHCONV`       | `1`                                     | Disables Git Bash path conversion                    |
| `MSYS2_ARG_CONV_EXCL`    | `*`                                     | Disables MSYS2 argument path rewriting               |
