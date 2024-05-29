/**
 * Emscripten's filesystem-related Exception.
 *
 * @see https://emscripten.org/docs/api_reference/Filesystem-API.html
 * @see https://github.com/emscripten-core/emscripten/blob/main/system/lib/libc/musl/arch/emscripten/bits/errno.h
 * @see https://github.com/emscripten-core/emscripten/blob/38eedc630f17094b3202fd48ac0c2c585dbea31e/system/include/wasi/api.h#L336
 */

export interface ErrnoError extends Error {
	node?: any;
	errno: number;
	message: string;
}
/**
 * @see https://github.com/emscripten-core/emscripten/blob/38eedc630f17094b3202fd48ac0c2c585dbea31e/system/include/wasi/api.h#L336
 */
export const FileErrorCodes = {
	0: 'No error occurred. System call completed successfully.',
	1: 'Argument list too long.',
	2: 'Permission denied.',
	3: 'Address in use.',
	4: 'Address not available.',
	5: 'Address family not supported.',
	6: 'Resource unavailable, or operation would block.',
	7: 'Connection already in progress.',
	8: 'Bad file descriptor.',
	9: 'Bad message.',
	10: 'Device or resource busy.',
	11: 'Operation canceled.',
	12: 'No child processes.',
	13: 'Connection aborted.',
	14: 'Connection refused.',
	15: 'Connection reset.',
	16: 'Resource deadlock would occur.',
	17: 'Destination address required.',
	18: 'Mathematics argument out of domain of function.',
	19: 'Reserved.',
	20: 'File exists.',
	21: 'Bad address.',
	22: 'File too large.',
	23: 'Host is unreachable.',
	24: 'Identifier removed.',
	25: 'Illegal byte sequence.',
	26: 'Operation in progress.',
	27: 'Interrupted function.',
	28: 'Invalid argument.',
	29: 'I/O error.',
	30: 'Socket is connected.',
	31: 'There is a directory under that path.',
	32: 'Too many levels of symbolic links.',
	33: 'File descriptor value too large.',
	34: 'Too many links.',
	35: 'Message too large.',
	36: 'Reserved.',
	37: 'Filename too long.',
	38: 'Network is down.',
	39: 'Connection aborted by network.',
	40: 'Network unreachable.',
	41: 'Too many files open in system.',
	42: 'No buffer space available.',
	43: 'No such device.',
	44: 'There is no such file or directory OR the parent directory does not exist.',
	45: 'Executable file format error.',
	46: 'No locks available.',
	47: 'Reserved.',
	48: 'Not enough space.',
	49: 'No message of the desired type.',
	50: 'Protocol not available.',
	51: 'No space left on device.',
	52: 'Function not supported.',
	53: 'The socket is not connected.',
	54: 'Not a directory or a symbolic link to a directory.',
	55: 'Directory not empty.',
	56: 'State not recoverable.',
	57: 'Not a socket.',
	58: 'Not supported, or operation not supported on socket.',
	59: 'Inappropriate I/O control operation.',
	60: 'No such device or address.',
	61: 'Value too large to be stored in data type.',
	62: 'Previous owner died.',
	63: 'Operation not permitted.',
	64: 'Broken pipe.',
	65: 'Protocol error.',
	66: 'Protocol not supported.',
	67: 'Protocol wrong type for socket.',
	68: 'Result too large.',
	69: 'Read-only file system.',
	70: 'Invalid seek.',
	71: 'No such process.',
	72: 'Reserved.',
	73: 'Connection timed out.',
	74: 'Text file busy.',
	75: 'Cross-device link.',
	76: 'Extension: Capabilities insufficient.',
} as any;

export function getEmscriptenFsError(e: any) {
	const errno = typeof e === 'object' ? ((e as any)?.errno as any) : null;
	if (errno in FileErrorCodes) {
		return FileErrorCodes[errno];
	}
}

export function rethrowFileSystemError(messagePrefix = '') {
	return function catchFileSystemError(
		target: any,
		methodName: string,
		descriptor: PropertyDescriptor
	) {
		const method = descriptor.value;
		descriptor.value = function (...args: any[]) {
			try {
				return method.apply(this, args);
			} catch (e) {
				const errno =
					typeof e === 'object' ? ((e as any)?.errno as any) : null;
				if (errno in FileErrorCodes) {
					const errmsg = FileErrorCodes[errno];
					const path = typeof args[1] === 'string' ? args[1] : null;
					const formattedPrefix =
						path !== null
							? messagePrefix.replaceAll('{path}', path)
							: messagePrefix;
					throw new Error(`${formattedPrefix}: ${errmsg}`, {
						cause: e,
					});
				}

				throw e;
			}
		};
	};
}
