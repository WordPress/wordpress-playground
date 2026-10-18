/**
 * Pack entries into the wire stream that {@link buildVfsLoadScript}
 * reads and {@link buildVfsDumpScript} writes.
 *
 * Wire format (per file, repeated):
 *
 *   uint32 LE  path length
 *   bytes      path (relative to the VFS root, forward slashes)
 *   uint32 LE  data length
 *   bytes      file contents
 *
 * The header carries the total entry count up front so the progress
 * callback can report a meaningful `total`.
 */
export function encodeVfsStream(
	entries: Array<{ relPath: string; data: Uint8Array }>
): Uint8Array {
	const textEncoder = new TextEncoder();
	const encodedPaths = entries.map((e) => textEncoder.encode(e.relPath));

	let totalBytes = 4;
	for (let i = 0; i < entries.length; i++) {
		totalBytes += 4 + encodedPaths[i].byteLength;
		totalBytes += 4 + entries[i].data.byteLength;
	}

	const buffer = new Uint8Array(totalBytes);
	const view = new DataView(buffer.buffer);
	let offset = 0;
	view.setUint32(offset, entries.length, true);
	offset += 4;
	for (let i = 0; i < entries.length; i++) {
		const pathBytes = encodedPaths[i];
		view.setUint32(offset, pathBytes.byteLength, true);
		offset += 4;
		buffer.set(pathBytes, offset);
		offset += pathBytes.byteLength;
		const data = entries[i].data;
		view.setUint32(offset, data.byteLength, true);
		offset += 4;
		buffer.set(data, offset);
		offset += data.byteLength;
	}
	return buffer;
}

/**
 * Reverse of {@link encodeVfsStream}. The returned `data` views share
 * the input buffer.
 */
export function decodeVfsStream(
	bytes: Uint8Array
): Array<{ relPath: string; data: Uint8Array }> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const textDecoder = new TextDecoder('utf-8');

	let offset = 0;
	const total = view.getUint32(offset, true);
	offset += 4;

	const entries: Array<{ relPath: string; data: Uint8Array }> = [];
	for (let i = 0; i < total; i++) {
		const pathLen = view.getUint32(offset, true);
		offset += 4;
		const pathBytes = bytes.subarray(offset, offset + pathLen);
		offset += pathLen;
		const dataLen = view.getUint32(offset, true);
		offset += 4;
		const data = bytes.subarray(offset, offset + dataLen);
		offset += dataLen;

		entries.push({ relPath: textDecoder.decode(pathBytes), data });
	}
	return entries;
}

/**
 * Build the PHP-CLI script the kernel worker spawns to enumerate and
 * dump the VFS subtree. The script:
 *
 *   1. Walks `vfsRoot` with `RecursiveDirectoryIterator`
 *      (`SKIP_DOTS | UNIX_PATHS`) and collects regular-file paths.
 *   2. Writes a `uint32 LE` count, then `[pathlen, path, datalen, data]`
 *      records to `php://stdout`. Paths are made relative to `vfsRoot`
 *      and use forward slashes — the JS side rebuilds the directory
 *      tree from the path components.
 *
 * `set_time_limit(0)` and `memory_limit = -1` keep PHP from killing
 * itself mid-walk on a stock WP install (default memory_limit is 128M;
 * file_get_contents on a large file plus output buffering can exceed
 * that). Errors from individual files are suppressed with `@` so a
 * single unreadable file doesn't abort the whole snapshot.
 */
export function buildVfsDumpScript(vfsRoot: string): string {
	const rootLiteral = phpLiteralString(vfsRoot);
	return `
		ini_set('memory_limit', '-1');
		set_time_limit(0);
		$root = ${rootLiteral};
		$rootLen = strlen($root) + 1;
		$it = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator(
				$root,
				FilesystemIterator::SKIP_DOTS |
					FilesystemIterator::UNIX_PATHS
			),
			RecursiveIteratorIterator::LEAVES_ONLY
		);
		$files = [];
		foreach ($it as $info) {
			if ($info->isFile()) {
				$files[] = $info->getPathname();
			}
		}
		$out = fopen('php://stdout', 'wb');
		fwrite($out, pack('V', count($files)));
		foreach ($files as $path) {
			$rel = substr($path, $rootLen);
			$data = @file_get_contents($path);
			if ($data === false) {
				$data = '';
			}
			fwrite($out, pack('V', strlen($rel)));
			fwrite($out, $rel);
			fwrite($out, pack('V', strlen($data)));
			fwrite($out, $data);
		}
		fflush($out);
	`;
}

/**
 * Mirror of {@link buildVfsDumpScript}: read the wire stream from
 * STDIN and replay it under `vfsRoot`. `read_exact` loops `fread`
 * because pipe reads aren't guaranteed to return the requested length
 * in one call — without it, a >8KB file would truncate and the next
 * length prefix would land out of alignment.
 */
export function buildVfsLoadScript(vfsRoot: string): string {
	const rootLiteral = phpLiteralString(vfsRoot);
	return `
		ini_set('memory_limit', '-1');
		set_time_limit(0);
		$root = ${rootLiteral};
		$in = fopen('php://stdin', 'rb');
		$read_exact = function ($stream, $len) {
			$buf = '';
			while ($len > 0) {
				$chunk = fread($stream, $len);
				if ($chunk === false || $chunk === '') {
					return false;
				}
				$buf .= $chunk;
				$len -= strlen($chunk);
			}
			return $buf;
		};
		$header = $read_exact($in, 4);
		if ($header === false) {
			fwrite(STDERR, "load: short read on header\\n");
			exit(2);
		}
		$count = unpack('V', $header)[1];
		for ($i = 0; $i < $count; $i++) {
			$pathLen = unpack('V', $read_exact($in, 4))[1];
			$rel = $read_exact($in, $pathLen);
			$dataLen = unpack('V', $read_exact($in, 4))[1];
			$data = $dataLen > 0 ? $read_exact($in, $dataLen) : '';
			if ($rel === false || $data === false) {
				fwrite(STDERR, "load: short read at record $i\\n");
				exit(3);
			}
			$absPath = $root . '/' . $rel;
			@mkdir(dirname($absPath), 0777, true);
			@file_put_contents($absPath, $data);
		}
	`;
}

function phpLiteralString(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
