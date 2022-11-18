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
	await Promise.all(
		files.map((file) => workerThread.unlink(pathJoin(path, file.fileName)))
	);
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

export function extname(fileName: string): string {
	const ext = getExtension(fileName);
	return ext ? `.${ext}` : '';
}

export function pathJoin(...parts: string[]) {
	return parts.join('/').replace(/\/+/g, '/');
}

export function normalizePath(path: string) {
	return path.replace(/\/+/g, '/');
}

export function basename(fileName: string): string {
	return fileName.split('/').pop()!;
}

export function dirname(fileName: string): string {
	return fileName.split('/').slice(0, -1).join('/');
}

export function relative(from: string, to: string): string {
	const fromParts = from.split('/');
	const toParts = to.split('/');
	const commonParts = fromParts.filter((x, i) => x === toParts[i]);
	return toParts.slice(commonParts.length).join('/');
}

export function resolve(...parts: string[]): string {
	return parts.reduce((acc, part) => {
		if (part.startsWith('/')) {
			return part;
		}
		return pathJoin(acc, part);
	});
}

export function sep(): string {
	return '/';
}

export function isAbsolute(path) {
	return path.startsWith('/') || /^[A-Za-z]:/.test(path);
}
