import { decodeZip } from '../zip/decode-zip';
import { readFile } from 'fs/promises';

describe('decodeZip', () => {
	it('Should uncompress compress files', async () => {
		const zipBytes = await readFile(
			__dirname + '/fixtures/hello-dolly.zip'
		);
		const zipStream = decodeZip(new Blob([zipBytes]).stream());

		const files = [];
		for await (const file of zipStream) {
			files.push(file);
		}
		expect(files.length).toBe(3);
		expect(files[0].name).toBe('hello-dolly/');
		expect(files[1].name).toBe('hello-dolly/hello.php');
		expect(files[1].size).toBe(2593);
		expect(files[2].name).toBe('hello-dolly/readme.txt');
		expect(files[2].size).toBe(624);
	});
});
