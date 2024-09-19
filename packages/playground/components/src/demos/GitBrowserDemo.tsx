import React, { useEffect, useMemo } from 'react';
import {
	FileTree,
	listDescendantFiles,
	listFiles,
	sparseCheckout,
} from '@wp-playground/storage';
import {
	Button,
	Flex,
	FlexItem,
	SelectControl,
	__experimentalInputControl as InputControl,
	Spinner,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { FilePickerControl } from '../FilePickerControl';
import { PromiseState, usePromise } from '../hooks/use-promise';
import { joinPaths } from '@php-wasm/util';

export default function GitBrowserDemo() {
	const [repoUrl, setRepoUrl] = React.useState(
		'http://127.0.0.1:5263/proxy.php/https://github.com/WordPress/wordpress-playground.git'
	);
	const [branch, setBranch] = React.useState('refs/heads/trunk');

	const [filesPromise, setFilesPromise] = React.useState<Promise<FileTree[]>>(
		() => Promise.resolve([])
	);
	const loadFiles = () => {
		const promise = listFiles(repoUrl, branch);
		setFilesPromise(promise);
	};
	const files = usePromise(filesPromise);
	useEffect(() => {
		loadFiles();
	}, []);

	const [pathMappings, setPathMappings] = React.useState<PathMapping[]>([
		{ gitPath: '', wpPath: '' },
	]);

	const [filesToCheckout, setFilesToCheckout] = React.useState<
		Record<string, string>
	>({});
	useEffect(() => {
		const newFilesToCheckout = pathMappings.flatMap(
			({ gitPath, wpPath }) => {
				if (!gitPath || !files.data || !wpPath) {
					return [];
				}
				return listDescendantFiles(files.data, gitPath).map(
					(filePath) => [
						filePath,
						joinPaths(
							wpPath,
							filePath.substring(gitPath.length)
						).replace(/\/$/g, ''),
					]
				);
			}
		);
		setFilesToCheckout(Object.fromEntries(newFilesToCheckout));
	}, [pathMappings, files.data]);

	const [checkedOutFiles, setCheckedOutFiles] = React.useState<
		Record<string, string>
	>({});

	async function doSparseCheckout() {
		const result = await sparseCheckout(
			repoUrl,
			branch,
			Object.keys(filesToCheckout)
		);
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
				<VStack spacing={4}>
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
					<Button variant="primary" onClick={() => loadFiles()}>
						{files?.isLoading && <Spinner />}
						Load files list
					</Button>
				</VStack>
			</FlexItem>
			{files?.isResolved && (
				<FlexItem style={{ width: '600px' }}>
					<h2 style={{ marginTop: 0 }}>Path mappings</h2>
					{pathMappings.map((pathMapping, index) => (
						<PathMappingRow
							key={index}
							value={pathMapping}
							files={files}
							onChange={(value) => {
								const newPathMappings = [...pathMappings];
								newPathMappings[index] = value;
								setPathMappings(newPathMappings);
							}}
						/>
					))}
					<Button
						variant="primary"
						onClick={() =>
							setPathMappings([
								...pathMappings,
								{ gitPath: '', wpPath: '' },
							])
						}
					>
						Add path mapping
					</Button>
				</FlexItem>
			)}
			{files?.isResolved && Object.keys(filesToCheckout).length > 0 && (
				<FlexItem>
					<h3>Selected path:</h3>
					<pre>
						{JSON.stringify(
							pathMappings
								.filter(({ gitPath }) => gitPath)
								.map(({ gitPath }) => gitPath),
							null,
							2
						)}
					</pre>
					<h3>Repository files to checkout:</h3>
					<pre>{JSON.stringify(filesToCheckout, null, 2)}</pre>
					<button onClick={() => doSparseCheckout()}>
						Sparse checkout mapped files
					</button>
					<h3>Checked out files:</h3>
					<pre>{JSON.stringify(checkedOutFiles, null, 2)}</pre>
				</FlexItem>
			)}
		</Flex>
	);
}

interface PathMapping {
	gitPath: string;
	wpPath: string;
}

function PathMappingRow({
	value,
	files,
	onChange,
}: {
	value: PathMapping;
	files: PromiseState<FileTree[]>;
	onChange: (value: PathMapping) => void;
}) {
	const basePath = '/wordpress';
	const [selectedPathType, setSelectedPathType] = React.useState<
		'' | 'mu-plugin' | 'plugin' | 'theme' | 'custom'
	>('');
	const [customPath, setCustomPath] = React.useState(value.wpPath);
	useEffect(() => {
		const givenWpPath = value.wpPath || '';
		if (!givenWpPath) {
			return;
		}
		const segments = givenWpPath.split('/');
		const lastWpSegment = segments.pop() || '';
		const lastGitSegment = lastWpSegment.split('/').pop();
		if (lastGitSegment !== lastWpSegment) {
			console.log('custom path', {
				lastGitSegment,
				lastWpSegment,
			});
			setSelectedPathType('custom');
			setCustomPath(value.wpPath);
			return;
		}

		const beginning = segments.join('/');
		switch (beginning) {
			case `${basePath}/wp-content/plugins`:
				setSelectedPathType('plugin');
				break;
			case `${basePath}/wp-content/themes`:
				setSelectedPathType('theme');
				break;
			case `${basePath}/wp-content/mu-plugins`:
				setSelectedPathType('mu-plugin');
				break;
			default:
				console.log('custom path', {
					beginning,
					value,
				});
				setSelectedPathType('custom');
				setCustomPath(value.wpPath);
				break;
		}
	}, []);

	const effectiveWpPath = useMemo(() => {
		if (!value.gitPath || (!selectedPathType && !customPath)) {
			return '';
		}
		const lastSegment = value.gitPath.split('/').pop();
		switch (selectedPathType) {
			case 'plugin':
				return `${basePath}/wp-content/plugins/${lastSegment}`;
			case 'theme':
				return `${basePath}/wp-content/themes/${lastSegment}`;
			case 'mu-plugin':
				return `${basePath}/wp-content/mu-plugins/${lastSegment}`;
			case 'custom':
				return customPath;
			default:
				return '';
		}
	}, [selectedPathType, customPath, value.gitPath]);

	useEffect(() => {
		onChange({ ...value, wpPath: effectiveWpPath });
	}, [effectiveWpPath]);

	return (
		<Flex direction="row" gap={4} justify="flex-start" align="flex-start">
			<FlexItem>
				<FilePickerControl
					files={files.data || []}
					isLoading={files.isLoading}
					error={files.error?.message || ''}
					value={value.gitPath}
					onChange={(path) => onChange({ ...value, gitPath: path })}
				/>
			</FlexItem>
			<FlexItem>
				<SelectControl
					label="Mount at"
					value={selectedPathType}
					onChange={(value) => setSelectedPathType(value as any)}
					options={[
						{ label: '--- Select ---', value: '' },
						{ label: 'Plugin', value: 'plugin' },
						{ label: 'Theme', value: 'theme' },
						{ label: 'mu-plugin', value: 'mu-plugin' },
						{ label: 'Custom path', value: 'custom' },
					]}
				/>
				{selectedPathType === 'custom' && (
					<InputControl
						label="Custom path"
						value={customPath}
						autoFocus
						onChange={(value) => setCustomPath(value as string)}
					/>
				)}
			</FlexItem>
		</Flex>
	);
}
