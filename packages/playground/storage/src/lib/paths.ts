import { FileTree } from './git-sparse-checkout';

export function listDescendantFiles(files: FileTree[], selectedPath: string) {
	if (!selectedPath) {
		return [];
	}

	// Calculate the list of files to checkout based on the mapping
	const descendants: string[] = [];
	const segments = selectedPath.split('/');
	let currentTree: FileTree[] | null = files;
	for (const segment of segments) {
		const file = currentTree?.find(
			(file) => file.name === segment
		) as FileTree;
		if (file?.type === 'folder') {
			currentTree = file.children;
		} else if (file) {
			return [file.name];
		} else {
			return [];
		}
	}

	const stack = [{ tree: currentTree, path: selectedPath }];
	while (stack.length > 0) {
		const { tree, path } = stack.pop() as {
			tree: FileTree[];
			path: string;
		};
		for (const file of tree) {
			if (file.type === 'folder') {
				stack.push({
					tree: file.children,
					path: `${path}/${file.name}`,
				});
			} else {
				descendants.push(`${path}/${file.name}`);
			}
		}
	}
	return descendants;
}
