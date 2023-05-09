/**
 * @license
 * Copyright 2018 The Emscripten Authors
 * SPDX-License-Identifier: MIT
 */
mergeInto(LibraryManager.library, {
	$SELECTIVERAWFS__deps: ['$ERRNO_CODES', '$FS', '$NODEFS', '$mmapAlloc', '$FS_modeStringToFlags'],
	$SELECTIVERAWFS__postset: `
	  if (ENVIRONMENT_IS_NODE) {
		FS["RAW_DIRECTORIES"] = ["/dev", "/proc"];
		var fs = require('fs');
		var _wrapNodeError = function(originalFunc, rawFsFunc) {
		  return function(parentOrPath) {
			var path = 
				(typeof parentOrPath === 'string' ? parentOrPath :
				typeof parentOrPath === 'object' ? parentOrPath.path
				: '') + '';
			var shouldUseRawFs = false;
			FS["RAW_DIRECTORIES"].forEach(function(rawPrefix) {
				if(path.startsWith(rawPrefix)) {
					shouldUseRawFs = true;
				}
			});
			if(!shouldUseRawFs) {
				return originalFunc.apply(this, arguments);
			}
			try {
			  return rawFsFunc.apply(this, arguments)
			} catch (e) {
			  if (e.code) {
				throw new FS.ErrnoError(ERRNO_CODES[e.code]);
			  }
			  throw e;
			}
		  }
		};
		var VFS = Object.assign({}, FS);
		for (var _key in SELECTIVERAWFS) {
		  FS[_key] = _wrapNodeError(FS[_key], SELECTIVERAWFS[_key]);
		}
	  } else {
		throw new Error("SELECTIVERAWFS is currently only supported on Node.js environment.")
	  }`,
	$SELECTIVERAWFS: {
		lookup: function (parent, name) {
			return FS.lookupPath(parent.path + '/' + name).node;
		},
		lookupPath: function (path, opts = {}) {
			if (opts.parent) {
				path = nodePath.dirname(path);
			}
			var st = fs.lstatSync(path);
			var mode = NODEFS.getMode(path);
			return { path: path, node: { id: st.ino, mode: mode, node_ops: SELECTIVERAWFS, path: path } };
		},
		createStandardStreams: function () {
			FS.streams[0] = FS.createStream({ nfd: 0, position: 0, path: '', flags: 0, tty: true, seekable: false }, 0, 0);
			for (var i = 1; i < 3; i++) {
				FS.streams[i] = FS.createStream({ nfd: i, position: 0, path: '', flags: 577, tty: true, seekable: false }, i, i);
			}
		},
		// generic function for all node creation
		cwd: function () { return process.cwd(); },
		chdir: function () { process.chdir.apply(void 0, arguments); },
		mknod: function (path, mode) {
			if (FS.isDir(path)) {
				fs.mkdirSync(path, mode);
			} else {
				fs.writeFileSync(path, '', { mode: mode });
			}
		},
		mkdir: function () { fs.mkdirSync.apply(void 0, arguments); },
		symlink: function () { fs.symlinkSync.apply(void 0, arguments); },
		rename: function () { fs.renameSync.apply(void 0, arguments); },
		rmdir: function () { fs.rmdirSync.apply(void 0, arguments); },
		readdir: function () { return ['.', '..'].concat(fs.readdirSync.apply(void 0, arguments)); },
		unlink: function () { fs.unlinkSync.apply(void 0, arguments); },
		readlink: function () { return fs.readlinkSync.apply(void 0, arguments); },
		stat: function () { return fs.statSync.apply(void 0, arguments); },
		lstat: function () { return fs.lstatSync.apply(void 0, arguments); },
		chmod: function () { fs.chmodSync.apply(void 0, arguments); },
		fchmod: function () { fs.fchmodSync.apply(void 0, arguments); },
		chown: function () { fs.chownSync.apply(void 0, arguments); },
		fchown: function () { fs.fchownSync.apply(void 0, arguments); },
		truncate: function () { fs.truncateSync.apply(void 0, arguments); },
		ftruncate: function (fd, len) {
			// See https://github.com/nodejs/node/issues/35632
			if (len < 0) {
				throw new FS.ErrnoError(22);
			}
			fs.ftruncateSync.apply(void 0, arguments);
		},
		utime: function (path, atime, mtime) { fs.utimesSync(path, atime / 1000, mtime / 1000); },
		open: function (path, flags, mode, suggestFD) {
			if (typeof flags == "string") {
				flags = FS_modeStringToFlags(flags)
			}
			var pathTruncated = path.split('/').map(function (s) { return s.substr(0, 255); }).join('/');
			var nfd = fs.openSync(pathTruncated, NODEFS.flagsForNode(flags), mode);
			var st = fs.fstatSync(nfd);
			if (flags & 65536 && !st.isDirectory()) {
				fs.closeSync(nfd);
				throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
			}
			var newMode = NODEFS.getMode(pathTruncated);
			var fd = suggestFD != null ? suggestFD : FS.nextfd(nfd);
			var node = { id: st.ino, mode: newMode, node_ops: SELECTIVERAWFS, path: path }
			var stream = FS.createStream({ nfd: nfd, position: 0, path: path, flags: flags, node: node, seekable: true }, fd, fd);
			FS.streams[fd] = stream;
			return stream;
		},
		createStream: function (stream, fd_start, fd_end) {
			// Call the original FS.createStream
			var rtn = VFS.createStream(stream, fd_start, fd_end);
			if (typeof rtn.shared.refcnt == 'undefined') {
				rtn.shared.refcnt = 1;
			} else {
				rtn.shared.refcnt++;
			}
			return rtn;
		},
		closeStream: function (fd) {
			if (FS.streams[fd]) {
				FS.streams[fd].shared.refcnt--;
			}
			VFS.closeStream(fd);
		},
		close: function (stream) {
			FS.closeStream(stream.fd);
			if (!stream.stream_ops && stream.shared.refcnt === 0) {
				// this stream is created by in-memory filesystem        
				fs.closeSync(stream.nfd);
			}
		},
		llseek: function (stream, offset, whence) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.llseek(stream, offset, whence);
			}
			var position = offset;
			if (whence === 1) {
				position += stream.position;
			} else if (whence === 2) {
				position += fs.fstatSync(stream.nfd).size;
			} else if (whence !== 0) {
				throw new FS.ErrnoError(22);
			}
  
			if (position < 0) {
				throw new FS.ErrnoError(22);
			}
			stream.position = position;
			return position;
		},
		read: function (stream, buffer, offset, length, position) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.read(stream, buffer, offset, length, position);
			}
			var seeking = typeof position != 'undefined';
			if (!seeking && stream.seekable) position = stream.position;
			var bytesRead = fs.readSync(stream.nfd, Buffer.from(buffer.buffer), offset, length, position);
			// update position marker when non-seeking
			if (!seeking) stream.position += bytesRead;
			return bytesRead;
		},
		write: function (stream, buffer, offset, length, position) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.write(stream, buffer, offset, length, position);
			}
			if (stream.flags & +"1024") {
				// seek to the end before writing in append mode
				FS.llseek(stream, 0, +"2");
			}
			var seeking = typeof position != 'undefined';
			if (!seeking && stream.seekable) position = stream.position;
			var bytesWritten = fs.writeSync(stream.nfd, Buffer.from(buffer.buffer), offset, length, position);
			// update position marker when non-seeking
			if (!seeking) stream.position += bytesWritten;
			return bytesWritten;
		},
		allocate: function () {
			throw new FS.ErrnoError(138);
		},
		mmap: function (stream, length, position, prot, flags) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.mmap(stream, length, position, prot, flags);
			}
  
			var ptr = mmapAlloc(length);
			FS.read(stream, HEAP8, ptr, length, position);
			return { ptr: ptr, allocated: true };
		},
		msync: function (stream, buffer, offset, length, mmapFlags) {
			if (stream.stream_ops) {
				// this stream is created by in-memory filesystem
				return VFS.msync(stream, buffer, offset, length, mmapFlags);
			}
  
			FS.write(stream, buffer, 0, length, offset);
			// should we check if bytesWritten and length are the same?
			return 0;
		},
		munmap: function () {
			return 0;
		},
		ioctl: function () {
			throw new FS.ErrnoError(59);
		}
	}
});


