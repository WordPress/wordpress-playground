import { crc32 } from '../zip/crc32';

describe('crc32', () => {
	it('Should compute the crc32 checksum', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4, 5]);
		const checksum = crc32(bytes);
		expect(checksum).toBe(1191942644);
	});
});
