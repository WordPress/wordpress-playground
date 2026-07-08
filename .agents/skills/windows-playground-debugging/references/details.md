# Windows Playground Debugging - Detailed Reference

This file covers provider-specific access notes and deeper Windows caveats. Follow the
main workflow in [../SKILL.md](../SKILL.md) first.

## Choosing an Execution Adapter

Do not block on VM automation. Use whichever Windows command surface is available:

- Native Windows terminal, Windows Terminal, PowerShell, or `cmd`.
- RDP, VM console, or another interactive desktop session.
- SSH, WinRM, or PowerShell Remoting if the Windows machine is configured for it.
- VM guest-exec tools when installed and licensed, such as Parallels `prlctl exec`,
  VMware `vmrun`, or VirtualBox `VBoxManage guestcontrol`.

For providers without reliable guest execution, such as many UTM setups, use RDP,
console access, SSH, or a Windows-side script the user can run manually.

Provider guest-exec tools differ in credentials, quoting, working directories, and
environment inheritance. Keep the Windows command in a `.cmd` or `.ps1` file when it is
more than a one-liner, then invoke that script through the provider adapter.

## Shared Folder Discovery

Common shared-folder UNC roots include:

| Provider or access path | Common UNC pattern                     |
| ----------------------- | -------------------------------------- |
| Parallels               | `\\Mac\<share>`                        |
| VMware Fusion           | `\\vmware-host\Shared Folders\<share>` |
| VirtualBox              | `\\VBOXSVR\<share>`                    |
| RDP drive redirection   | `\\tsclient\<drive>`                   |
| SMB file server         | `\\<server>\<share>`                   |

Confirm the actual path from Windows:

```powershell
net use
Get-ChildItem '\\<server-or-provider-root>'
Test-Path '<HOST_SHARE>\package.json'
```

Shared folders are SMB-like network filesystems. They are useful for reading host
changes but can break symlinks, npm linking, file watching, and Nx workspace detection.
For full installs, builds, and tests, copy or clone the repo to a local NTFS path inside
Windows.

## Local NTFS Checkout Setup

Use this when network-share behavior may be hiding the real issue:

```powershell
git clone <repo-url> C:\src\wordpress-playground
Set-Location C:\src\wordpress-playground
git checkout <branch-or-commit>
npm ci
```

If the change exists only on the host worktree, either commit it to a temporary branch,
create a patch and apply it in Windows, or copy the modified files into the Windows
checkout. Do not debug from a stale Windows clone.

## Node.js Setup

Install the Node.js version from the repo's `.nvmrc` inside Windows. Choose the
installer or package-manager command that matches the Windows architecture (`ARM64` vs
`AMD64`/x64). Do not hardcode a download URL; use the current official installer or the
user's preferred Windows package manager.

Verify:

```powershell
where.exe node
node --version
npm --version
npx --version
```

Some provider guest-exec tools run in a service or system context and may not inherit
the interactive user's PATH. In that case, use full executable paths such as:

- `C:\Program Files\nodejs\node.exe`
- `C:\Program Files\nodejs\npm.cmd`
- `C:\Program Files\nodejs\npx.cmd`

## Command Quoting

Prefer scripts over deeply nested quoting:

1. Create `.context/windows-debug/run.ps1` or `.context/windows-debug/run.cmd`.
2. Put the Windows commands in that file.
3. Invoke the file from the Windows shell or VM adapter.

When using PowerShell directly inside Windows, `$` does not need escaping. When
embedding PowerShell in a POSIX shell string, escape `$` as `\$`.

When using `cmd` from a UNC path, use one of:

```cmd
net use <DRIVE> "<HOST_SHARE>" /persistent:no
cd /d <DRIVE>\
```

or:

```cmd
pushd "<HOST_SHARE>"
```

`pushd` creates a temporary drive mapping for the current `cmd` session.

## Parallels Optional Adapter

Use this only when the user has Parallels Desktop and wants host-side automation from
macOS.

Full paths:

- `"/Applications/Parallels Desktop.app/Contents/MacOS/prlctl"`
- `"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl"`

Discover and inspect VMs:

```bash
prlctl list -a
prlctl list -i "<VM_NAME>"
"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl" info --license
```

`prlctl exec` requires Parallels Desktop Pro or Business Edition. Standard Edition does
not support it.

Run a Windows command:

```bash
prlctl exec "<VM_NAME>" cmd /c "ver"
prlctl exec "<VM_NAME>" powershell -NoProfile -Command "[System.Environment]::OSVersion.VersionString"
```

Parallels `prlctl exec` runs as `SYSTEM`. It may not inherit user PATH, user drive
mappings, or npm profile directories. If npm fails because the SYSTEM npm directory is
missing:

```bash
prlctl exec "<VM_NAME>" cmd /c "if not exist C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm mkdir C:\WINDOWS\system32\config\systemprofile\AppData\Roaming\npm"
```

Create a Parallels host share for the current checkout when needed:

```bash
prlctl set "<VM_NAME>" --shf-host-add <SHARE_NAME> --path "$(pwd)" --mode rw --enable
prlctl exec "<VM_NAME>" cmd /c "dir \\\\Mac\\<SHARE_NAME>\\package.json"
```

## Build Prerequisites

### Visual C++ Build Tools

Native npm packages may require Python and Microsoft C++ build tools, especially on
Windows ARM64 or when prebuilds are unavailable. Install the tools that match the
Windows architecture. Ask before installing system components if the environment is not
owned by the current task.

### Windows ARM64 npm Caveat

`npm ci --install-links` can still fail on native packages, such as `sharp`, when no
Node.js, Windows, and ARM64 prebuild exists for the requested package version. For
profiling-only workflows where dependency postinstall output is not needed,
`npm install --install-links --ignore-scripts` may be enough. For full builds and tests,
install native build tooling instead of masking postinstall failures.

### Unix Commands in Build Scripts

Some scripts expect Unix utilities. Install Git for Windows and set these only for the
affected command session:

```powershell
$env:ComSpec = 'C:\Program Files\Git\bin\bash.exe'
$env:PATH = 'C:\Program Files\Git\usr\bin;' + $env:PATH
```

If Git Bash rewrites paths unexpectedly:

```powershell
$env:MSYS_NO_PATHCONV = '1'
$env:MSYS2_ARG_CONV_EXCL = '*'
```

## Symlink Behavior Matrix

| Environment                   | Symlink location   | Typical behavior                              |
| ----------------------------- | ------------------ | --------------------------------------------- |
| Windows local NTFS            | `C:\` or similar   | Works with Developer Mode, admin, or SYSTEM   |
| Windows network/shared folder | SMB/provider share | Often unsupported or unreliable               |
| macOS host filesystem         | Local macOS path   | Works on macOS but may not work through share |
| Provider guest-exec as SYSTEM | Windows local NTFS | Usually has symlink privileges                |

When a failure might be symlink-related, reproduce on Windows-local NTFS before
changing application code.

## Running Tests Directly in PowerShell

When running directly in PowerShell:

```powershell
Set-Location '<REPO>\packages\php-wasm\node'
$env:NX_WORKSPACE_ROOT_PATH = '<REPO>\'
$env:NX_DAEMON = 'false'
npm exec vitest -- run --config vite.config.ts src/test/symlinks.spec.ts
```

Use Nx for normal package tests from the workspace root:

```powershell
Set-Location '<REPO>'
$env:NX_DAEMON = 'false'
npm exec nx -- test <package-name> --testFile=<test-file-name>
```
