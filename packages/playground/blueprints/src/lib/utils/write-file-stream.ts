import { FileEntry, UniversalPHP, writeFileEntry } from '@php-wasm/universal';

export class WriteFileStream extends WritableStream {
	constructor(php: UniversalPHP, root: string) {
		super({
			async write(file: FileEntry) {
				await writeFileEntry(php, root, file);
			},
		});
	}
}
