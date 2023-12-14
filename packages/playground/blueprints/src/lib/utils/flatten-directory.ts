import type { UniversalPHP } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';

export async function flattenDirectory(
	php: UniversalPHP,
	directoryPath: string,
	defaultName: string
) {
	const parentPath = dirname(directoryPath);

	const filesInside = await php.listFiles(directoryPath);
	if (filesInside.length === 1) {
		const onlyFilePath = joinPaths(directoryPath, filesInside[0]);
		const isDir = await php.isDir(onlyFilePath);
		if (isDir) {
			const finalPath = joinPaths(parentPath, filesInside[0]);
			await php.mv(onlyFilePath, finalPath);
			await php.rmdir(directoryPath, { recursive: true });
			return finalPath;
		}
	}

	const finalPath = joinPaths(parentPath, defaultName);
	await php.mv(directoryPath, finalPath);
	return finalPath;
}
