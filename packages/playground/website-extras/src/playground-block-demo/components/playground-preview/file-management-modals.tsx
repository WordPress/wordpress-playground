/**
 * File management modals for creating and renaming files.
 *
 * Provides modal dialogs for adding new files and editing file names,
 * with support for remote URL file sources.
 */

import {
	useState,
	useImperativeHandle,
	forwardRef,
	type ForwardedRef,
} from 'react';
import type { EditorFile } from '../../base64';
import { __ } from '../../i18n';
import type { EditorFileMapper } from './use-editor-files';

interface FileManagementModalsProps {
	updateFile: (mapper: EditorFileMapper, index?: number) => void;
	addFile: (file: EditorFile, index?: number) => void;
	setActiveFileIndex: (index: number) => void;
	files: EditorFile[];
	activeFileIndex: number;
}

export interface FileManagerRef {
	setEditFileNameModalOpen: (open: boolean) => void;
	setNewFileModalOpen: (open: boolean) => void;
}

interface FileNameModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (name: string, remoteUrl?: string) => void;
	initialName?: string;
	initialRemoteUrl?: string;
	title: string;
	submitLabel: string;
	isLoading?: boolean;
	error?: string | null;
}

function FileNameModal({
	isOpen,
	onClose,
	onSubmit,
	initialName = '',
	initialRemoteUrl = '',
	title,
	submitLabel,
	isLoading = false,
	error = null,
}: FileNameModalProps) {
	const [name, setName] = useState(initialName);
	const [remoteUrl, setRemoteUrl] = useState(initialRemoteUrl);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(name, remoteUrl || undefined);
	};

	return (
		<div className="playground-modal-overlay" onClick={onClose}>
			<div
				className="playground-modal"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<h2 id="modal-title">{title}</h2>
				<form onSubmit={handleSubmit}>
					<div className="playground-modal-field">
						<label htmlFor="file-name">{__('File name')}</label>
						<input
							id="file-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="example.php"
							autoFocus
							disabled={isLoading}
						/>
					</div>
					<div className="playground-modal-field">
						<label htmlFor="remote-url">
							{__('Remote URL (optional)')}
						</label>
						<input
							id="remote-url"
							type="url"
							value={remoteUrl}
							onChange={(e) => setRemoteUrl(e.target.value)}
							placeholder="https://example.com/file.php"
							disabled={isLoading}
						/>
						<p className="playground-modal-help">
							{__(
								'If provided, the file contents will be fetched from this URL.'
							)}
						</p>
					</div>
					{error && <p className="playground-modal-error">{error}</p>}
					<div className="playground-modal-actions">
						<button
							type="button"
							onClick={onClose}
							disabled={isLoading}
							className="playground-button playground-button-secondary"
						>
							{__('Cancel')}
						</button>
						<button
							type="submit"
							disabled={!name || isLoading}
							className="playground-button playground-button-primary"
						>
							{isLoading ? __('Loading...') : submitLabel}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

const FileManagementModals = forwardRef(function FileManagementModals(
	{
		updateFile,
		addFile,
		setActiveFileIndex,
		files,
		activeFileIndex,
	}: FileManagementModalsProps,
	ref: ForwardedRef<FileManagerRef>
) {
	const [editFileNameModalOpen, setEditFileNameModalOpen] = useState(false);
	const [newFileModalOpen, setNewFileModalOpen] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [downloadError, setDownloadError] = useState<string | null>(null);

	useImperativeHandle(ref, () => ({
		setEditFileNameModalOpen: (open: boolean) => {
			setDownloadError(null);
			setEditFileNameModalOpen(open);
		},
		setNewFileModalOpen: (open: boolean) => {
			setDownloadError(null);
			setNewFileModalOpen(open);
		},
	}));

	async function resolveFileContents(remoteUrl?: string): Promise<string> {
		if (!remoteUrl) return '';
		const response = await fetch(remoteUrl, { credentials: 'omit' });
		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.statusText}`);
		}
		return await response.text();
	}

	async function handleUpdateFile(name: string, remoteUrl?: string) {
		setIsDownloading(true);
		setDownloadError(null);
		try {
			const contents = await resolveFileContents(remoteUrl);
			updateFile((file) => ({
				...file,
				name,
				remoteUrl,
				contents: remoteUrl ? contents : file.contents,
			}));
			setEditFileNameModalOpen(false);
		} catch (error) {
			setDownloadError(
				error instanceof Error ? error.message : 'Failed to fetch file'
			);
		} finally {
			setIsDownloading(false);
		}
	}

	async function handleCreateFile(name: string, remoteUrl?: string) {
		setIsDownloading(true);
		setDownloadError(null);
		try {
			const contents = await resolveFileContents(remoteUrl);
			addFile({ name, contents, remoteUrl });
			setActiveFileIndex(files.length);
			setNewFileModalOpen(false);
		} catch (error) {
			setDownloadError(
				error instanceof Error ? error.message : 'Failed to fetch file'
			);
		} finally {
			setIsDownloading(false);
		}
	}

	const activeFile = files[activeFileIndex];

	return (
		<>
			<FileNameModal
				isOpen={editFileNameModalOpen}
				onClose={() => setEditFileNameModalOpen(false)}
				onSubmit={handleUpdateFile}
				initialName={activeFile?.name || ''}
				initialRemoteUrl={activeFile?.remoteUrl || ''}
				title={__('Edit File Name')}
				submitLabel={__('Save')}
				isLoading={isDownloading}
				error={downloadError}
			/>
			<FileNameModal
				isOpen={newFileModalOpen}
				onClose={() => setNewFileModalOpen(false)}
				onSubmit={handleCreateFile}
				title={__('New File')}
				submitLabel={__('Create')}
				isLoading={isDownloading}
				error={downloadError}
			/>
		</>
	);
});

export default FileManagementModals;
