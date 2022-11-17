import type { SpawnedWorkerThread } from '../../php-wasm-browser/index';

export type MemFile = {
	fileName: string;
	contents: string;
};

export async function cleanDirectory(
	workerThread: SpawnedWorkerThread,
	path: string
) {
	const files = await readFiles(workerThread, path);
	await Promise.all(files.map((file) => workerThread.unlink(file.fileName)));
}

export async function readFiles(
	workerThread: SpawnedWorkerThread,
	source: string
): Promise<MemFile[]> {
	const fileNames = await workerThread.listFiles(source);
	const contents = await Promise.all(
		fileNames.map((fileName) =>
			workerThread.readFile(pathJoin(source, fileName))
		)
	);
	return fileNames.map((fileName, i) => ({
		fileName,
		contents: contents[i],
	}));
}

export async function writeFiles(
	workerThread: SpawnedWorkerThread,
	destination: string,
	files: MemFile[]
) {
	await Promise.all(
		files.map(({ fileName, contents }) =>
			workerThread.writeFile(pathJoin(destination, fileName), contents)
		)
	);
}

export function getExtension(fileName: string): string {
	return fileName.includes('.') ? fileName.split('.').pop()! : '';
}

export function pathJoin(...parts: string[]) {
	return parts.join('/').replace(/\/+/g, '/');
}
