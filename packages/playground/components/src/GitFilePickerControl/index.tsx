import React, { useEffect, useMemo, useState } from 'react';
import {
	FileTree,
	listDescendantFiles,
	listFiles,
} from '@wp-playground/storage';
import { Spinner } from '@wordpress/components';
import css from './style.module.css';
import FilePickerTree, { FilePickerControlProps } from '../FilePickerTree';
import { FilePickerControl } from '../FilePickerControl';
import { usePromise } from '../hooks/use-promise';

interface GitPathPickerProps {
	repoUrl: string;
	branch: string;
	selectedPath?: string;
	onSelect: (selection: GitPathSelection) => void;
}

interface GitPathSelection {
	path: string;
	descendants: string[];
}

export function GitFilePickerControl({
	repoUrl,
	branch,
	selectedPath = '',
	onSelect,
}: GitPathPickerProps) {
	const [isOpen, setIsOpen] = useState(false);

	/**
	 * Only request the list of files from the Git repository when the modal is open.
	 */
	const [filesPromise, setFilesPromise] = useState<{
		branch?: string;
		repoUrl?: string;
		filesPromise: Promise<FileTree[]>;
	}>(() => ({
		filesPromise: Promise.resolve([]),
	}));
	useEffect(() => {
		if (
			isOpen &&
			(filesPromise?.branch !== branch ||
				filesPromise?.repoUrl !== repoUrl)
		) {
			setFilesPromise({
				branch,
				repoUrl,
				filesPromise: listFiles(repoUrl, branch),
			});
		}
	}, [repoUrl, branch, isOpen]);

	const {
		isLoading,
		error,
		data: files,
	} = usePromise(filesPromise.filesPromise);

	const descendantPaths = useMemo(() => {
		if (files && selectedPath) {
			return listDescendantFiles(files, selectedPath);
		}
		return [];
	}, [files, selectedPath]);

	function handleSelect(path: string) {
		onSelect({ path, descendants: descendantPaths });
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
							<h2>Error loading git files</h2>
							<p>{error?.message}</p>
						</div>
					);
				}

				return <FilePickerTree {...props} />;
			}}
		/>
	);
}
