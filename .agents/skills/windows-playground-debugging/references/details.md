# Windows Playground Debugging — Detailed Reference

## VM Management

```bash
# List all VMs
prlctl list -a

# Check VM details and Parallels Tools status
prlctl list -i "Windows 11 (1)"

# Check license edition (must be Pro or Business)
"/Applications/Parallels Desktop.app/Contents/MacOS/prlsrvctl" info --license
# Look for edition="pro" or edition="business"
```

Full path to prlctl: `"/Applications/Parallels Desktop.app/Contents/MacOS/prlctl"`

Use the VM name from `prlctl list -a` in all `prlctl exec` commands.

## Shared Folder Discovery

Check which macOS shares are visible inside Windows before mapping a drive letter:

```bash
prlctl exec "Windows 11 (1)" cmd /c "dir \\Mac"
prlctl exec "Windows 11 (1)" cmd /c "net use"
```

If the repository is not visible, enable or add a host shared folder in Parallels first.
Shared Profile may expose only Desktop, Documents, and Downloads, which may not include a
Conductor workspace.

## Node.js Installation

### Node.js 20 (for published CLI)

```bash
prlctl exec "Windows 11 (1)" powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi' -OutFile 'C:\\Users\\Public\\node-install.msi'"
prlctl exec "Windows 11 (1)" cmd /c "msiexec /i C:\\Users\\Public\\node-install.msi /qn /norestart"
```

### Node.js 22 (for dev CLI)

```bash
prlctl exec "Windows 11 (1)" powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi' -OutFile 'C:\\Users\\Public\\node22-install.msi'"
prlctl exec "Windows 11 (1)" powershell -Command "Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i','C:\\Users\\Public\\node22-install.msi','/qn','/norestart' -Wait"
```

### Verify

```bash
prlctl exec "Windows 11 (1)" cmd /c "\"C:\\Program Files\\nodejs\\node.exe\" --version"
```

## SYSTEM User Setup

prlctl exec runs as SYSTEM. One-time setup needed:

```bash
# Create npm directory
prlctl exec "Windows 11 (1)" cmd /c "mkdir C:\\WINDOWS\\system32\\config\\systemprofile\\AppData\\Roaming\\npm"
```

Always use full paths for executables:
- Node: `"C:\\Program Files\\nodejs\\node.exe"`
- npm: `"C:\\Program Files\\nodejs\\npm.cmd"`
- npx: `"C:\\Program Files\\nodejs\\npx.cmd"`

## Build Prerequisites

### Visual C++ Redistributable

```bash
prlctl exec "Windows 11 (1)" powershell -Command "Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile 'C:\\Users\\Public\\vc_redist.x64.exe'; Start-Process -FilePath 'C:\\Users\\Public\\vc_redist.x64.exe' -ArgumentList '/install','/quiet','/norestart' -Wait"
```

### Network Drive Build Issues

1. **Symlinks** → use `npm install --install-links`
2. **NX WASM fallback** → `npm install @nx/nx-win32-x64-msvc`
3. **Workspace detection** → set `NX_WORKSPACE_ROOT_PATH`
4. **Unix commands** → set `ComSpec` to Git bash, prepend Git usr/bin to PATH

## Verifying the Server

```bash
prlctl exec "Windows 11 (1)" powershell -Command "
  \$response = Invoke-WebRequest -Uri 'http://127.0.0.1:9400' -UseBasicParsing -TimeoutSec 10;
  Write-Host 'Status:' \$response.StatusCode;
  Write-Host 'Size:' \$response.Content.Length 'bytes';
"
```

## Symlink Test Behavior Matrix

| Environment | Symlink Location | Behavior |
|-------------|------------------|----------|
| macOS | Local filesystem | Works normally |
| Windows (local drive) | C:\ or similar | Works with Developer Mode or admin |
| Windows (network drive) | Z:\ (Parallels share) | Auto-copies to local temp directory |
| Windows via prlctl | Network drive | Works (SYSTEM user has privileges) |

Symlink permissions on Windows require one of: Administrator privileges, Developer Mode enabled, or SYSTEM user (via prlctl).

## Running Tests Directly in Windows PowerShell

When running directly in PowerShell (not via prlctl), syntax differs slightly — no backslash escaping needed for `$`:

```powershell
cd Z:\packages\php-wasm\node
$env:NX_WORKSPACE_ROOT_PATH = 'Z:\'
$env:NX_DAEMON = 'false'
& 'C:\Program Files\nodejs\npx.cmd' vitest run --config vite.config.ts src/test/symlinks.spec.ts
```

The `&` operator before the path is required to execute the command.
