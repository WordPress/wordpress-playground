// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var path = require('path');
var fs = require('fs');

/**
 * Try to load a prebuilt binary from the binaries directory.
 * Falls back to the locally built binary if no prebuilt is found.
 */
function loadBinding() {
	var platform = process.platform;
	var archName = process.arch;
	var nodeVersion = process.versions.node.split('.')[0] + '.0.0';

	// Check if running in Electron
	var isElectron = !!(process.versions && process.versions.electron);
	var electronVersion = isElectron ? process.versions.electron : null;

	// Try to find matching binaries
	var binariesDir = path.join(__dirname, 'binaries');
	var files;
	try {
		files = fs.readdirSync(binariesDir);
	} catch (e) {
		// Binaries directory doesn't exist, fall back to build
		return null;
	}

	// Build the expected filename pattern
	// Format: fs-ext-{platform}-{arch}[-libc]-{runtime}-{version}.node
	var platformArch = platform + '-' + archName;

	// Filter files that match our platform/arch
	var candidates = files.filter(function (f) {
		return (
			f.startsWith('fs-ext-') &&
			f.includes(platformArch) &&
			f.endsWith('.node')
		);
	});

	// Try Electron first if running in Electron
	if (isElectron && electronVersion) {
		var electronBinary = candidates.find(function (f) {
			return f.includes('electron-' + electronVersion);
		});
		if (electronBinary) {
			try {
				return require(path.join(binariesDir, electronBinary));
			} catch (e) {
				// Failed to load, continue to Node binary
			}
		}
	}

	// Try to find exact Node version match first, then fall back to major version
	var nodeBinary = candidates.find(function (f) {
		return f.includes('node-' + nodeVersion);
	});

	if (!nodeBinary) {
		// Try to find any node binary for this platform (use highest version <= current)
		var nodeVersionNum = parseInt(process.versions.node.split('.')[0], 10);
		var nodeCandidates = candidates
			.filter(function (f) {
				return f.includes('-node-');
			})
			.map(function (f) {
				var match = f.match(/-node-(\d+)\./);
				return match
					? { file: f, version: parseInt(match[1], 10) }
					: null;
			})
			.filter(function (c) {
				return c && c.version <= nodeVersionNum;
			})
			.sort(function (a, b) {
				return b.version - a.version;
			});

		if (nodeCandidates.length > 0) {
			nodeBinary = nodeCandidates[0].file;
		}
	}

	if (nodeBinary) {
		return require(path.join(binariesDir, nodeBinary));
	}

	// No matching prebuilt found
	return null;
}

// Try loading prebuilt binaries, fallback to the node-gyp built binary
let binding;
try {
	binding = loadBinding();
	if (!binding) {
		// No prebuilt found, try the local build
		binding = require('./build/Release/fs_ext.node');
	}
} catch (e) {
	// loadBinding threw an error, try local build as last resort
	try {
		binding = require('./build/Release/fs_ext.node');
	} catch (buildError) {
		throw new Error(
			'Failed to load fs-ext native module. ' +
				'No prebuilt binary found for ' +
				process.platform +
				'-' +
				process.arch +
				' (Node ' +
				process.version +
				'), and no local build available. ' +
				'Original error: ' +
				e.message
		);
	}
}

// Used by flock
function stringToFlockFlags(flag) {
	// Only mess with strings
	if (typeof flag !== 'string') {
		return flag;
	}
	switch (flag) {
		case 'sh':
			return binding.constants.LOCK_SH;

		case 'ex':
			return binding.constants.LOCK_EX;

		case 'shnb':
			return binding.constants.LOCK_SH | binding.constants.LOCK_NB;

		case 'exnb':
			return binding.constants.LOCK_EX | binding.constants.LOCK_NB;

		case 'un':
			return binding.constants.LOCK_UN;

		default:
			throw new Error('Unknown flock flag: ' + flag);
	}
}

// used by Fcntl
function stringToFcntlFlags(flag) {
	if (typeof flag !== 'string') {
		return flag;
	}

	switch (flag) {
		case 'getfd':
			return binding.constants.F_GETFD;

		case 'setfd':
			return binding.constants.F_SETFD;

		case 'setlk':
			return binding.constants.F_SETLK;

		case 'setlkw':
			return binding.constants.F_SETLKW;

		case 'getlk':
			return binding.constants.F_GETLK;

		default:
			throw new Error('Unknown fcntl flag: ' + flag);
	}
}

function noop() {}

exports.flock = function (fd, flags, callback) {
	callback = arguments[arguments.length - 1];
	if (typeof callback !== 'function') {
		callback = noop;
	}

	var oper = stringToFlockFlags(flags);

	binding.flock(fd, oper, callback);
};

exports.flockSync = function (fd, flags) {
	var oper = stringToFlockFlags(flags);

	return binding.flock(fd, oper);
};

exports.fcntl = function (fd, cmd, arg, callback) {
	cmd = stringToFcntlFlags(cmd);
	if (arguments.length < 4) {
		callback = arg;
		arg = 0;
	}
	if (!arg) arg = 0;
	return binding.fcntl(fd, cmd, arg, callback);
};

exports.fcntlSync = function (fd, cmd, arg) {
	cmd = stringToFcntlFlags(cmd);
	if (!arg) arg = 0;
	return binding.fcntl(fd, cmd, arg);
};

exports.seek = function (fd, position, whence, callback) {
	callback = arguments[arguments.length - 1];
	if (typeof callback !== 'function') {
		callback = noop;
	}

	binding.seek(fd, position, whence, callback);
};

exports.seekSync = function (fd, position, whence) {
	return binding.seek(fd, position, whence);
};

exports.statVFS = function (path, callback) {
	path = path || '/';
	return binding.statVFS(path, callback);
};

// Windows-only: LockFileEx binding
// lockFileEx(fd, flags, offsetLow, offsetHigh, lengthLow, lengthHigh [, callback])
// flags: 0 for shared lock, LOCKFILE_EXCLUSIVE_LOCK for exclusive, can OR with LOCKFILE_FAIL_IMMEDIATELY
exports.lockFileEx = function (
	fd,
	flags,
	offsetLow,
	offsetHigh,
	lengthLow,
	lengthHigh,
	callback
) {
	if (!binding.lockFileEx) {
		throw new Error('lockFileEx is only available on Windows');
	}
	callback = arguments[arguments.length - 1];
	if (typeof callback !== 'function') {
		callback = noop;
	}
	return binding.lockFileEx(
		fd,
		flags,
		offsetLow,
		offsetHigh,
		lengthLow,
		lengthHigh,
		callback
	);
};

exports.lockFileExSync = function (
	fd,
	flags,
	offsetLow,
	offsetHigh,
	lengthLow,
	lengthHigh
) {
	if (!binding.lockFileEx) {
		throw new Error('lockFileEx is only available on Windows');
	}
	return binding.lockFileEx(
		fd,
		flags,
		offsetLow,
		offsetHigh,
		lengthLow,
		lengthHigh
	);
};

// Windows-only: UnlockFileEx binding
// unlockFileEx(fd, offsetLow, offsetHigh, lengthLow, lengthHigh [, callback])
exports.unlockFileEx = function (
	fd,
	offsetLow,
	offsetHigh,
	lengthLow,
	lengthHigh,
	callback
) {
	if (!binding.unlockFileEx) {
		throw new Error('unlockFileEx is only available on Windows');
	}
	callback = arguments[arguments.length - 1];
	if (typeof callback !== 'function') {
		callback = noop;
	}
	return binding.unlockFileEx(
		fd,
		offsetLow,
		offsetHigh,
		lengthLow,
		lengthHigh,
		callback
	);
};

exports.unlockFileExSync = function (
	fd,
	offsetLow,
	offsetHigh,
	lengthLow,
	lengthHigh
) {
	if (!binding.unlockFileEx) {
		throw new Error('unlockFileEx is only available on Windows');
	}
	return binding.unlockFileEx(
		fd,
		offsetLow,
		offsetHigh,
		lengthLow,
		lengthHigh
	);
};

exports.constants = binding.constants;
