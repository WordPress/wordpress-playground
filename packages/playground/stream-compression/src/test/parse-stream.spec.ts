import { unzipFiles } from '../zip/parse-stream';
import { readFile } from 'fs/promises';
import 'blob-polyfill';

describe('unzipFiles', () => {
	it('Should uncompress compress files', async () => {
		const zipBytes = await readFile(
			__dirname + '/fixtures/hello-dolly.zip'
		);
		const zipStream = unzipFiles(new Blob([zipBytes]).stream());

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
