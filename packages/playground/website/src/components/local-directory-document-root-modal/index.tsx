import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Spinner } from '@wordpress/components';
import {
	FilePickerTree,
	type FilePickerTreeHandle,
} from '@wp-playground/components';
import {
	EventedFilesystem,
	OpfsFilesystemBackend,
	type AsyncWritableFilesystem,
} from '@wp-playground/storage';
import {
	getLocalDirectoryPickerPath,
	getRelativeLocalDirectoryDocumentRoot,
} from '../../lib/local-directory-site';
import css from './style.module.css';

/**
 * Selects a directory-only PHP document root within a local project.
 *
 * The tree cannot modify the project, and the selected path is returned relative
 * to the fixed local-directory mountpoint used during boot.
 */
export function LocalDirectoryDocumentRootModal({
	directoryHandle,
	initialDocumentRoot,
	onRequestClose,
	onSelect,
}: {
	directoryHandle: FileSystemDirectoryHandle;
	/** Relative document root; an empty string selects the mount root. */
	initialDocumentRoot: string;
	onRequestClose: () => void;
	onSelect: (documentRoot: string) => Promise<void>;
}) {
	const [filesystem, setFilesystem] =
		useState<AsyncWritableFilesystem | null>(null);
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const selectionRequestRef = useRef(0);
	const treeRef = useRef<FilePickerTreeHandle>(null);
	const lastAcceptedDirectoryRef = useRef('/');

	useEffect(() => {
		let cancelled = false;
		setFilesystem(null);
		setSelectedPath(null);
		setError(undefined);
		const loadFilesystem = async () => {
			await ensureDirectoryPermission(directoryHandle);
			const nextFilesystem = new EventedFilesystem(
				OpfsFilesystemBackend.fromDirectoryHandle(directoryHandle)
			);
			// Force a read before rendering so permission errors stay in this modal
			// instead of looking like an empty directory tree.
			await nextFilesystem.listFiles('/');
			let initialPath = getLocalDirectoryPickerPath(initialDocumentRoot);
			if (!(await nextFilesystem.isDir(initialPath))) {
				initialPath = '/';
			}
			if (!cancelled) {
				lastAcceptedDirectoryRef.current = initialPath;
				setFilesystem(nextFilesystem);
				setSelectedPath(initialPath);
			}
		};

		void loadFilesystem().catch((cause) => {
			if (!cancelled) {
				setError(getFilesystemErrorMessage(cause));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [directoryHandle, initialDocumentRoot]);

	/**
	 * Keeps selection directory-only and accepts a directory only when its
	 * filesystem check is still the latest selection request.
	 */
	const handleTreeSelection = async (path: string | null) => {
		const request = ++selectionRequestRef.current;
		if (!path || !filesystem) {
			treeRef.current?.focusPath(lastAcceptedDirectoryRef.current, {
				select: true,
				notify: false,
			});
			return;
		}
		try {
			if (
				(await filesystem.isDir(path)) &&
				request === selectionRequestRef.current
			) {
				lastAcceptedDirectoryRef.current = path;
				setSelectedPath(path);
			} else if (request === selectionRequestRef.current) {
				treeRef.current?.focusPath(lastAcceptedDirectoryRef.current, {
					select: true,
					notify: false,
				});
			}
		} catch {
			// Files and unreadable entries are not valid document-root choices.
			treeRef.current?.focusPath(lastAcceptedDirectoryRef.current, {
				select: true,
				notify: false,
			});
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!selectedPath) {
			return;
		}
		setError(undefined);
		setIsSubmitting(true);
		try {
			await onSelect(getRelativeLocalDirectoryDocumentRoot(selectedPath));
		} catch (cause) {
			setError(getFilesystemErrorMessage(cause));
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			title="Choose a document root"
			onRequestClose={onRequestClose}
			className={css.modal}
		>
			<form className={css.form} onSubmit={handleSubmit}>
				<p className={css.description}>
					Choose the folder served by PHP. Files outside it remain
					available to the application. Currently serving{' '}
					<code>
						{getLocalDirectoryPickerPath(initialDocumentRoot)}
					</code>
					.
				</p>
				{error ? <p role="alert">{error}</p> : null}
				{filesystem ? (
					<div className={css.tree}>
						<FilePickerTree
							ref={treeRef}
							filesystem={filesystem}
							root="/"
							initialSelectedPath={selectedPath ?? undefined}
							readOnly
							withContextMenu={false}
							onSelect={(path) => {
								void handleTreeSelection(path);
							}}
						/>
					</div>
				) : error ? null : (
					<div className={css.loading} role="status">
						<Spinner />
						<span>Reading directory…</span>
					</div>
				)}
				<div className={css.footer}>
					<Button
						variant="tertiary"
						type="button"
						disabled={isSubmitting}
						onClick={onRequestClose}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						type="submit"
						disabled={!selectedPath || isSubmitting}
						isBusy={isSubmitting}
					>
						{isSubmitting ? 'Opening…' : 'Use this directory'}
					</Button>
				</div>
			</form>
		</Modal>
	);
}

/**
 * Requests read/write access when the browser exposes permission methods.
 *
 * The tree is read-only UI, but the eventual project mount must be writable.
 * A filesystem read then verifies readable access before rendering the tree.
 */
async function ensureDirectoryPermission(
	directoryHandle: FileSystemDirectoryHandle
) {
	const permissionHandle = directoryHandle as FileSystemDirectoryHandle & {
		queryPermission?: (options: {
			mode: 'readwrite';
		}) => Promise<PermissionState>;
		requestPermission?: (options: {
			mode: 'readwrite';
		}) => Promise<PermissionState>;
	};
	if (
		!permissionHandle.queryPermission ||
		!permissionHandle.requestPermission
	) {
		return;
	}
	let permission = await permissionHandle.queryPermission({
		mode: 'readwrite',
	});
	if (permission === 'prompt') {
		permission = await permissionHandle.requestPermission({
			mode: 'readwrite',
		});
	}
	if (permission !== 'granted') {
		throw new DOMException(
			'Permission to read this directory was denied.',
			'NotAllowedError'
		);
	}
}

function getFilesystemErrorMessage(cause: unknown) {
	if ((cause as DOMException | undefined)?.name === 'NotAllowedError') {
		return 'Permission to read this directory was denied.';
	}
	return cause instanceof Error
		? cause.message
		: 'The selected directory could not be read.';
}
