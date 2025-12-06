# @wp-playground/fs-ext

A fork of [fs-ext](https://github.com/baudehlo/node-fs-ext) that ships prebuilt binaries for all major platforms and adds Windows-specific file locking APIs.

## Why this fork?

The original `fs-ext` package requires compilation during `npm install`, which can fail in environments without build tools. This fork:

- **Ships prebuilt binaries** for macOS (x64, arm64), Linux (x64, arm64), and Windows (x64, arm64)
- **Adds `LockFileEx`/`UnlockFileEx`** Windows APIs for byte-range file locking
- **Supports Node.js 20+** and Electron
- **Falls back to local compilation** if no prebuilt binary matches your platform

## Installation

```sh
npm install @wp-playground/fs-ext
```

## Usage

```js
const { flock, flockSync } = require('@wp-playground/fs-ext');
const fs = require('fs');

const fd = fs.openSync('foo.txt', 'r');
flock(fd, 'ex', (err) => {
	if (err) {
		return console.error("Couldn't lock file");
	}
	// file is locked
});
```

## API

### flock(fd, flags, [callback])

Asynchronous flock(2). No arguments other than a possible error are passed to
the callback. Flags can be 'sh', 'ex', 'shnb', 'exnb', 'un' and correspond
to the various LOCK_SH, LOCK_EX, LOCK_SH|LOCK_NB, etc.

NOTE (from flock() man page): flock() does not lock files over NFS. Use fcntl(2)
instead: that does work over NFS, given a sufficiently recent version of Linux
and a server which supports locking.

### flockSync(fd, flags)

Synchronous flock(2). Throws an exception on error.

### fcntl(fd, cmd, [arg], [callback])

Asynchronous fcntl(2).

callback will be given two arguments (err, result).

The supported commands are:

- 'getfd' ( F_GETFD )
- 'setfd' ( F_SETFD )
- 'setlk' ( F_SETLK )
- 'getlk' ( F_GETLK )
- 'setlkw' ( F_SETLKW )

### fcntlSync(fd, flags)

Synchronous fcntl(2). Throws an exception on error.

### seek(fd, offset, whence, [callback])

Asynchronous lseek(2).

callback will be given two arguments (err, currFilePos).

whence can be 0 (SEEK_SET) to set the new position in bytes to offset,
1 (SEEK_CUR) to set the new position to the current position plus offset
bytes (can be negative), or 2 (SEEK_END) to set to the end of the file
plus offset bytes (usually negative or zero to seek to the end of the file).

### seekSync(fd, offset, whence)

Synchronous lseek(2). Throws an exception on error. Returns current file position.

### lockFileEx(fd, flags, offsetLow, offsetHigh, lengthLow, lengthHigh, [callback]) - Windows only

Asynchronous LockFileEx. Locks a byte range in a file.

Flags:

- `0` - shared lock
- `constants.LOCKFILE_EXCLUSIVE_LOCK` - exclusive lock
- `constants.LOCKFILE_FAIL_IMMEDIATELY` - non-blocking (can be OR'd with above)

### lockFileExSync(fd, flags, offsetLow, offsetHigh, lengthLow, lengthHigh) - Windows only

Synchronous LockFileEx. Throws an exception on error.

### unlockFileEx(fd, offsetLow, offsetHigh, lengthLow, lengthHigh, [callback]) - Windows only

Asynchronous UnlockFileEx. Unlocks a byte range in a file.

### unlockFileExSync(fd, offsetLow, offsetHigh, lengthLow, lengthHigh) - Windows only

Synchronous UnlockFileEx. Throws an exception on error.

## Constants

Available via `require('@wp-playground/fs-ext').constants`:

- `LOCK_SH`, `LOCK_EX`, `LOCK_NB`, `LOCK_UN` - flock flags
- `F_GETFD`, `F_SETFD`, `F_GETLK`, `F_SETLK`, `F_SETLKW` - fcntl commands
- `F_RDLCK`, `F_WRLCK`, `F_UNLCK` - fcntl lock types
- `FD_CLOEXEC` - close-on-exec flag
- `LOCKFILE_EXCLUSIVE_LOCK`, `LOCKFILE_FAIL_IMMEDIATELY` - Windows LockFileEx flags

## License

MIT
