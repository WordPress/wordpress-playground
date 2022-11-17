import React from 'react';
import { useCallback, useMemo } from 'react';
import { Tree } from '@geist-ui/core';
import { useDeferredValue } from '../hooks';

const noop = () => {};

interface FilesSource {
	/**
	 * Lists the files and directories in the given directory.
	 *
	 * @param  path - The directory path to list.
	 * @returns The list of files and directories in the given directory.
	 */
	listFiles(path: string): MaybePromise<string[]>;
	/**
	 * Checks if a directory exists in the PHP filesystem.
	 *
	 * @param path – The path to check.
	 * @returns True if the path is a directory, false otherwise.
	 */
	isDir(path: string): MaybePromise<boolean>;
}

type MaybePromise<T> = Promise<T> | T;

interface FilesExplorerProps {
	root?: string;
	onSelectFile?: (path: string) => void;
	filesSource: FilesSource;
}

export default function FilesExplorer({
	root = '/',
	onSelectFile = noop,
	filesSource,
}: FilesExplorerProps) {
	const onClick = useCallback((file) => {
		onSelectFile(joinPath(root, file));
	}, []);

	const treePromise = useTreeComponents(filesSource, root);
	const tree = useDeferredValue(treePromise) as any;

	return <Tree onClick={onClick}>{tree}</Tree>;
}

async function useTreeComponents(
	filesSource: FilesSource,
	root: string
): Promise<any> {
	return useMemo(() => {
		return buildTreeComponents(filesSource, root);
	}, [filesSource, root]);
}

async function buildTreeComponents(filesSource: FilesSource, root: string) {
	const files = await filesSource.listFiles(root);

	return await Promise.all(
		files.map(async (file) => {
			const path = joinPath(root, file);
			const isDir = await filesSource.isDir(path);
			if (isDir) {
				return (
					<Tree.Folder name={file} key={file}>
						{(await buildTreeComponents(filesSource, path)) as any}
					</Tree.Folder>
				);
			} else {
				return <Tree.File name={file} key={file} />;
			}
		})
	);
}

function joinPath(...parts: string[]) {
	return parts.join('/').replace(/\/+/g, '/');
}
