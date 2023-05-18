import fs from 'fs-extra';

/**
 *
 * @param filePath The path to the file to read.
 * @param length The number of bytes to read from the file. By default 8KB.
 * @returns The first `length` bytes of the file as string.
 * @see https://developer.wordpress.org/reference/functions/get_file_data/
 */
export function readFileHead(filePath: string, length = 8192) {
	const buffer = Buffer.alloc(length);
	const fd = fs.openSync(filePath, 'r');
	fs.readSync(fd, buffer, 0, buffer.length, 0);
	const fileContentBuffer = buffer.toString('utf8');
	fs.closeSync(fd);
	return fileContentBuffer.toString();
}
