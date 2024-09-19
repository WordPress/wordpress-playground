import React from 'react';
import {
	FileTree,
	listDescendantFiles,
	listFiles,
	sparseCheckout,
} from '@wp-playground/storage';
import {
	Flex,
	FlexItem,
	SelectControl,
	__experimentalInputControl as InputControl,
} from '@wordpress/components';
import { GitFilePickerControl } from '.';

export default function GitBrowserDemo() {
	const [repoUrl, setRepoUrl] = React.useState(
		'http://127.0.0.1:5263/proxy.php/https://github.com/WordPress/wordpress-playground.git'
	);
	const [branch, setBranch] = React.useState('refs/heads/trunk');
	const [customPath, setCustomPath] = React.useState('/wordpress/');
	const [selectedPathType, setSelectedPathType] = React.useState<
		'mu-plugin' | 'plugin' | 'theme' | 'custom'
	>('mu-plugin');
	const [selectedPath, setSelectedPath] = React.useState('');
	const [files, setFiles] = React.useState<FileTree[]>([]);
	React.useEffect(() => {
		listFiles(repoUrl, branch).then(setFiles);
	}, []);
	const filesToCheckout = React.useMemo(() => {
		return listDescendantFiles(files, selectedPath);
	}, [files, selectedPath]);

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
		<Flex direction="row" gap={4} justify="flex-start" align="flex-start">
			<FlexItem>
				<InputControl
					label="Repository URL"
					value={repoUrl}
					onChange={(value) => setRepoUrl(value as string)}
				/>
				<InputControl
					label="Branch"
					value={branch}
					onChange={(value) => setBranch(value as string)}
				/>
				<GitFilePickerControl
					repoUrl={repoUrl}
					branch={branch}
					selectedPath={selectedPath}
					onSelect={(selection) => setSelectedPath(selection.path)}
				/>
			</FlexItem>
			<FlexItem style={{ width: '300px' }}>
				<h2>Path mapping</h2>
				<SelectControl
					label="Map as"
					disabled={!selectedPath}
					value={selectedPathType}
					onChange={(value) => setSelectedPathType(value as any)}
					options={[
						{ label: 'Plugin', value: 'plugin' },
						{ label: 'Theme', value: 'theme' },
						{ label: 'mu-plugin', value: 'mu-plugin' },
						{ label: 'Custom path', value: 'custom' },
					]}
				/>
				{selectedPath && (
					<>
						{selectedPathType === 'custom' && (
							<InputControl
								disabled={!selectedPath}
								label="Custom path"
								value={customPath}
								autoFocus
								onChange={(value) =>
									setCustomPath(value as string)
								}
							/>
						)}
						<h3>Mapped as:</h3>
						{(function () {
							const basePath = '/wordpress';
							const lastSegment = selectedPath.split('/').pop();
							switch (selectedPathType) {
								case 'plugin':
									return `${basePath}/wp-content/plugins/${lastSegment}`;
								case 'theme':
									return `${basePath}/wp-content/themes/${lastSegment}`;
								case 'mu-plugin':
									return `${basePath}/wp-content/mu-plugins/${lastSegment}`;
								case 'custom':
									return customPath;
							}
						})()}
					</>
				)}
			</FlexItem>
			<FlexItem>
				<h3>Selected path:</h3>
				<pre>{JSON.stringify(selectedPath, null, 2)}</pre>
				<h3>Repository files to checkout:</h3>
				<pre>{JSON.stringify(filesToCheckout, null, 2)}</pre>
				<button onClick={() => doSparseCheckout()}>
					Sparse checkout mapped files
				</button>
				<h3>Checked out files:</h3>
				<pre>{JSON.stringify(checkedOutFiles, null, 2)}</pre>
			</FlexItem>
		</Flex>
	);
}
