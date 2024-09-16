import React from 'react';
import PathMappingControl from './PathMappingControl';
import { FileTree, listFiles, sparseCheckout } from '@wp-playground/storage';

const repoUrl =
	'http://127.0.0.1:5263/proxy.php/https://github.com/WordPress/wordpress-playground.git';
const branch = 'refs/heads/trunk';

export default function GitBrowserDemo() {
	const [mapping, setMapping] = React.useState({});
	const [files, setFiles] = React.useState<FileTree[]>([]);
	React.useEffect(() => {
		listFiles(repoUrl, branch).then(setFiles);
	}, []);
	const filesToCheckout = React.useMemo(() => {
		// Calculate the list of files to checkout based on the mapping
		const filesToCheckout: string[] = [];
		for (const mappedPath of Object.keys(mapping)) {
			const segments = mappedPath.split('/');
			let currentTree: FileTree[] | null = files;
			for (const segment of segments) {
				const file = currentTree?.find(
					(file) => file.name === segment
				) as FileTree;
				if (file?.type === 'folder') {
					currentTree = file.children;
				} else {
					currentTree = null;
					filesToCheckout.push(file!.name);
					break;
				}
			}

			if (currentTree === null) {
				break;
			}

			const stack = [{ tree: currentTree, path: mappedPath }];
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
						filesToCheckout.push(`${path}/${file.name}`);
					}
				}
			}
		}
		console.log({ filesToCheckout });
		return filesToCheckout;
	}, [files, mapping]);

	const [checkedOutFiles, setCheckedOutFiles] = React.useState<
		Record<string, string>
	>({});
	async function doSparseCheckout() {
		const result = await sparseCheckout(repoUrl, branch, filesToCheckout);
		const checkedOutFiles: Record<string, string> = {};
		for (const filename in result) {
			checkedOutFiles[filename] = new TextDecoder().decode(
				result[filename]
			);
		}
		setCheckedOutFiles(checkedOutFiles);
	}
	return (
		<div>
			<style>
				{`.path-mapping-control td:last-child {
					width: 500px;
				}`}
			</style>
			<PathMappingControl
				files={files}
				onMappingChange={(newMapping) => setMapping(newMapping)}
			/>
			<h3>Mapping:</h3>
			<pre>{JSON.stringify(mapping, null, 2)}</pre>
			<h3>Repository files to checkout:</h3>
			<pre>{JSON.stringify(filesToCheckout, null, 2)}</pre>
			<button onClick={() => doSparseCheckout()}>
				Sparse checkout mapped files
			</button>
			<h3>Checked out files:</h3>
			<pre>{JSON.stringify(checkedOutFiles, null, 2)}</pre>
		</div>
	);
}

const fileStructure = [
	{
		name: '/',
		type: 'folder' as const,
		children: [
			{
				name: 'Documents',
				type: 'folder' as const,
				children: [
					{ name: 'Resume.pdf', type: 'file' as const },
					{ name: 'CoverLetter.docx', type: 'file' as const },
				],
			},
			{
				name: 'Pictures',
				type: 'folder' as const,
				children: [
					{
						name: 'Vacation',
						type: 'folder' as const,
						children: [
							{ name: 'beach.png', type: 'file' as const },
						],
					},
				],
			},
			{ name: 'todo.txt', type: 'file' as const },
		],
	},
];
export function PathMappingControlDemo() {
	const [mapping, setMapping] = React.useState({});
	return (
		<div>
			<style>
				{`.path-mapping-control td:last-child {
					width: 500px;
				}`}
			</style>
			<PathMappingControl
				files={fileStructure}
				initialState={{ '/': { isOpen: true } }}
				onMappingChange={(newMapping) => setMapping(newMapping)}
			/>
			<h3>Mapping:</h3>
			<pre>{JSON.stringify(mapping, null, 2)}</pre>
		</div>
	);
}
