import { UniversalPHP, writeFile } from '@php-wasm/universal';

export class WriteFileStream extends WritableStream {
	constructor(php: UniversalPHP, root: string) {
		super({
			async write(file: File) {
				await writeFile(php, root, file);
			},
		});
	}
}
