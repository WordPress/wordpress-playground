import React, { useEffect, useState } from 'react';
import type { FileTree } from '@wp-playground/storage';
import { Spinner } from '@wordpress/components';
import css from './style.module.css';
import FilePickerTree, { FilePickerControlProps } from '../FilePickerTree';
import { FilePickerControl } from '../FilePickerControl';
import { usePromise } from '../hooks/use-promise';

interface AsyncPathPickerProps {
	loadFiles: () => Promise<FileTree[]>;
	selectedPath?: string;
	onSelect: (path: string) => void;
}

export function AsyncFilePickerControl({
	loadFiles,
	selectedPath = '',
	onSelect,
}: AsyncPathPickerProps) {
	const [isOpen, setIsOpen] = useState(false);

	/**
	 * Only request the list of files from the Async repository when the modal is open.
	 */
	const [filesPromise, setFilesPromise] = useState<{
		loadFiles?: any;
		filesPromise: Promise<FileTree[]>;
	}>(() => ({
		filesPromise: Promise.resolve([]),
	}));
	useEffect(() => {
		if (isOpen && loadFiles !== filesPromise?.loadFiles) {
			setFilesPromise({
				loadFiles,
				filesPromise: loadFiles(),
			});
		}
	}, [isOpen, loadFiles]);

	const {
		isLoading,
		error,
		data: files,
	} = usePromise(filesPromise.filesPromise);

	function handleSelect(path: string) {
		onSelect(path);
	}

	return (
		<FilePickerControl
			onOpen={() => setIsOpen(true)}
			onClose={() => setIsOpen(false)}
			files={files || []}
			value={selectedPath}
			onChange={handleSelect}
			filePickerTree={(props: FilePickerControlProps) => {
				if (isLoading) {
					return (
						<div className={css['loadingContainer']}>
							<Spinner />
						</div>
					);
				}

				if (error) {
					return (
						<div className={css['errorContainer']}>
							<h2>Error loading files</h2>
							<p>{error?.message}</p>
						</div>
					);
				}

				return <FilePickerTree {...props} />;
			}}
		/>
	);
}
