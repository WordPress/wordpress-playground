/**
 * CRC32 implementation.
 *
 * Credit: Alex from https://stackoverflow.com/a/18639999
 */
function makeCRCTable() {
	let c;
	const crcTable = [];
	for (let n = 0; n < 256; n++) {
		c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		crcTable[n] = c;
	}
	return crcTable;
}

let crcTable: number[] = [];
export function crc32(bytes: Uint8Array) {
	if (crcTable.length === 0) {
		crcTable = makeCRCTable();
	}
	let crc = 0 ^ -1;

	for (let i = 0; i < bytes.byteLength; i++) {
		crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
	}

	return (crc ^ -1) >>> 0;
}
