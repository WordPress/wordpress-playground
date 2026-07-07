# Windows Playground Debugging — Detailed Reference

This file only covers material that goes beyond [../SKILL.md](../SKILL.md). Follow the
Minimal Setup and Debugging Path there first.

## VM Management

Full path to `prlctl`: `"/Applications/Parallels Desktop.app/Contents/MacOS/prlctl"`

Use the VM name from `prlctl list -a` in all `prlctl exec` commands. In
`prlsrvctl info --license` output, the edition must be `pro` or `business`; Standard
edition does not support `prlctl exec`.

## Node.js Setup

Install the Node.js version from the repo's `.nvmrc` inside the VM if `node --version`
fails. Source workflows need at least Node.js 22 for type stripping. Choose the
installer or package-manager command that matches the VM architecture (`ARM64` vs
`AMD64`/x64). Do not hardcode a download URL; use the current official installer or the
user's preferred Windows package manager.

After installation, verify from the SYSTEM context used by `prlctl exec`:

```bash
prlctl exec "<VM_NAME>" cmd /c "\"C:\Program Files\nodejs\node.exe\" --version && \"C:\Program Files\nodejs\npx.cmd\" --version"
```

## Shared Folder Caveats

If the repository is not visible under `\\Mac`, enable or add a host shared folder in
Parallels first. Shared Profile may expose only Desktop, Documents, and Downloads, which
may not include the checkout under test.

When using an agent or worktree tool, share that exact worktree path directly. A
similarly named share may point at a separate root checkout that does not include the
workspace branch or unmerged changes.

## SYSTEM User Setup

`prlctl exec` runs as SYSTEM, so it does not inherit user drive mappings, PATH changes,
or npm profile directories. Always use full paths for executables when PATH is
uncertain:

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

Beyond the mapped-drive, `--install-links`, and Nx workspace-detection steps in
SKILL.md:

1. Nx native package: install the matching package for the VM architecture if Nx falls
   back to unsupported WASM behavior.
2. Unix commands: install Git for Windows and set `ComSpec`/`PATH` as shown in the
   Build From Source step of SKILL.md.

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
