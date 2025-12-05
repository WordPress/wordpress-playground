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

var binding = require('./build/Release/fs_ext.node');

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

exports.constants = binding.constants;
