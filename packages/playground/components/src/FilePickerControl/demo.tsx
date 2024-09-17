import React, { useEffect, useState } from 'react';
import FilePickerControl from './PathMappingControl';
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
	Button,
	Modal,
	Spinner,
} from '@wordpress/components';
import css from './style.module.css';

const repoUrl =
	'http://127.0.0.1:5263/proxy.php/https://github.com/WordPress/wordpress-playground.git';
const branch = 'refs/heads/trunk';

// const mockFileStructure = [
// 	{
// 		name: '/',
// 		type: 'folder' as const,
// 		children: [
// 			{
// 				name: 'Documents',
// 				type: 'folder' as const,
// 				children: [
// 					{ name: 'Resume.pdf', type: 'file' as const },
// 					{ name: 'CoverLetter.docx', type: 'file' as const },
// 				],
// 			},
// 			{
// 				name: 'Pictures',
// 				type: 'folder' as const,
// 				children: [
// 					{
// 						name: 'Vacation',
// 						type: 'folder' as const,
// 						children: [
// 							{ name: 'beach.png', type: 'file' as const },
// 						],
// 					},
// 				],
// 			},
// 			{ name: 'todo.txt', type: 'file' as const },
// 		],
// 	},
// ];

export default function GitBrowserDemo() {
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
		<div>
			<style>
				{`
			.path-mapping-control-wrapper {
				width: 300px;
				max-width: 300px;
				height: 500px;
				max-height: 500px;
				overflow-y: auto;
				border: 1px solid #ddd;
			}`}
			</style>
			<Flex
				direction="row"
				gap={4}
				justify="flex-start"
				align="flex-start"
			>
				<FlexItem>
					<GitPathControl
						value={selectedPath}
						onChange={(selection) =>
							setSelectedPath(selection.path)
						}
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
								const lastSegment = selectedPath
									.split('/')
									.pop();
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
		</div>
	);
}

interface GitPathPickerProps {
	repoUrl: string;
	branch: string;
	initialPath?: string;
	onSelect: (selection: GitPathSelection) => void;
}

interface GitPathSelection {
	path: string;
	descendants: string[];
}

export function GitPathPicker({
	repoUrl,
	branch,
	initialPath = '',
	onSelect,
}: GitPathPickerProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [files, setFiles] = useState<FileTree[]>([]);
	useEffect(() => {
		listFiles(repoUrl, branch)
			.then(setFiles)
			.finally(() => setIsLoading(false));
	}, [repoUrl, branch]);

	const [selectedPath, setSelectedPath] = useState(initialPath);

	const descendantPaths = React.useMemo(() => {
		if (files && selectedPath) {
			return listDescendantFiles(files, selectedPath);
		}
		return [];
	}, [files, selectedPath]);

	function handleSelect(path: string) {
		setSelectedPath(path);
		onSelect({ path, descendants: descendantPaths });
	}

	return (
		<>
			{isLoading && (
				<div className={css['loadingContainer']}>
					<Spinner />
				</div>
			)}
			<FilePickerControl
				files={files}
				initialPath={selectedPath}
				onSelect={handleSelect}
			/>
		</>
	);
}

export function GitPathControl({
	value = '',
	onChange,
}: {
	value?: string;
	onChange: (selection: GitPathSelection) => void;
}) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);

	const [lastSelectedPath, setLastSelectedPath] = useState<GitPathSelection>({
		path: value,
		descendants: [],
	});

	function handlePathSelect(selection: GitPathSelection) {
		setLastSelectedPath(selection);
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onChange(lastSelectedPath);
		closeModal();
	}

	return (
		<>
			<div className={css['pathMappingButtonWrapper']}>
				<InputControl
					label="Repository path"
					value={lastSelectedPath.path}
					onChange={(value) =>
						setLastSelectedPath({
							...lastSelectedPath,
							path: value as string,
						})
					}
				/>
				<Button variant="secondary" onClick={openModal}>
					Browse
				</Button>
			</div>
			{isOpen && (
				<Modal
					title="Select a path "
					onRequestClose={closeModal}
					className={css['pathMappingModal']}
				>
					<form onSubmit={handleSubmit}>
						<GitPathPicker
							repoUrl={repoUrl}
							branch={branch}
							initialPath={value}
							onSelect={handlePathSelect}
						/>
						<div className={css['modalFooter']}>
							<div className={css['buttonContainer']}>
								<Button type="submit" variant="primary">
									Select
								</Button>
							</div>
						</div>
					</form>
				</Modal>
			)}
		</>
	);
}
