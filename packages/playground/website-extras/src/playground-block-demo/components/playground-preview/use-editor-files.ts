/**
 * Custom React hook for managing editor files.
 *
 * Provides state management for multiple files in the code editor,
 * including adding, removing, updating, and tracking the active file.
 * Also supports fetching remote files and optional error log monitoring.
 */

import { useState, useCallback, useEffect } from 'react';
import { __, sprintf } from '../../i18n';
import type { EditorFile } from '../../base64';

export type UseEditorFilesOptions = {
	withErrorLog: boolean;
	getErrors?: () => Promise<string>;
};

export type EditorFileMapper = (file: EditorFile) => EditorFile;

export const ERROR_LOG_FILE_NAME = 'PHP error_log';

export function isErrorLogFile(file: EditorFile): boolean {
	return file.name === ERROR_LOG_FILE_NAME;
}

export default function useEditorFiles(
	filesAttribute: EditorFile[],
	{ withErrorLog = false, getErrors }: UseEditorFilesOptions
) {
	const [files, setFiles] = useState<EditorFile[]>(filesAttribute || []);
	const [activeFileIndex, setActiveFileIndex] = useState(0);
	const activeFile = files[activeFileIndex];

	const updateFile = useCallback(
		(mapper: EditorFileMapper, index: number = activeFileIndex) => {
			setFiles(
				files.map((file, i) => (i === index ? mapper(file) : file))
			);
		},
		[activeFileIndex, files, setFiles]
	);

	const removeFile = useCallback(
		(index: number = activeFileIndex) => {
			setFiles(files.filter((_, i) => i !== index));
		},
		[activeFileIndex, files]
	);

	const addFile = useCallback(
		(file: EditorFile, index = files.length) => {
			setFiles([...files.slice(0, index), file, ...files.slice(index)]);
		},
		[files, setFiles]
	);

	async function fetchRemoteFile(file: EditorFile) {
		try {
			const response = await fetch(file.remoteUrl!);
			const contents = await response.text();
			updateFile(
				(existingFile) => ({ ...existingFile, contents }),
				files.indexOf(file)
			);
		} catch {
			updateFile(
				(existingFile) => ({
					...existingFile,
					contents: sprintf(
						__('Failed to fetch the remote file from %s'),
						file.remoteUrl
					),
					name: sprintf(
						__('%s (Failed to fetch)'),
						existingFile.name
					),
				}),
				files.indexOf(file)
			);
		}
	}

	const [isLoading, setIsLoading] = useState(
		files.filter((file) => file.remoteUrl).length > 0
	);

	useEffect(() => {
		async function fetchRemoteFiles() {
			try {
				await Promise.all(
					files.filter((file) => file.remoteUrl).map(fetchRemoteFile)
				);
			} finally {
				setIsLoading(false);
			}
		}
		fetchRemoteFiles();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		async function doHandleErrorLog() {
			const errorLogIndex = files.findIndex(isErrorLogFile);
			if (withErrorLog) {
				if (errorLogIndex === -1) {
					addFile(
						{
							name: ERROR_LOG_FILE_NAME,
							contents: (await getErrors?.()) || '',
						},
						1
					);
				}
			} else {
				if (errorLogIndex !== -1) {
					removeFile(errorLogIndex);
				}
			}
		}
		doHandleErrorLog();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [withErrorLog]);

	useEffect(() => {
		if (!withErrorLog) {
			return;
		}
		const interval = setInterval(async function () {
			const errorLogIndex = files.findIndex(isErrorLogFile);
			if (errorLogIndex === -1) {
				return;
			}

			const errors = (await getErrors?.()) || '';
			if (errors === files[errorLogIndex].contents) {
				return;
			}
			updateFile(
				(file) => ({ ...file, contents: errors }),
				errorLogIndex
			);
		}, 1000);
		return () => clearInterval(interval);
	}, [withErrorLog, files, getErrors, updateFile]);

	return {
		files,
		addFile,
		isLoading,
		updateFile,
		removeFile,
		activeFile,
		activeFileIndex,
		setActiveFileIndex,
	};
}
