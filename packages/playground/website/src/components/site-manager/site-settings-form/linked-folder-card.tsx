import { useEffect, useState } from 'react';
import { Button } from '@wordpress/components';
import { logger } from '@php-wasm/logger';
import css from './linked-folder-card.module.css';
import { useAppSelector } from '../../../lib/state/redux/store';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';
import {
	useDocumentRootPicker,
	useReloadFromDisk,
} from '../../../lib/hooks/use-local-folder';
import { loadDirectoryHandle } from '../../../lib/state/opfs/opfs-directory-handle-storage';
import {
	probeDirectoryHandle,
	requestDirectoryHandlePermission,
} from '../../../lib/local-directory-handle';
import { getLocalDirectoryPickerPath } from '../../../lib/local-directory-site';
import { LocalDirectoryDocumentRootModal } from '../../local-directory-document-root-modal';

/**
 * The linked folder as two ordinary settings rows, sharing the form's
 * side-label geometry. A repair action appears only when the browser's folder
 * access is actually broken; deleting the link lives in the Playgrounds pane.
 */
export function LinkedFolderCard({ siteSlug }: { siteSlug: string }) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const sitesAPI = useSitesAPI();
	const { reloadFromDisk, isReloading } = useReloadFromDisk();
	const documentRootPicker = useDocumentRootPicker();
	const [folderName, setFolderName] = useState<string | null>(null);
	const [folderAccess, setFolderAccess] = useState<
		'checking' | 'ok' | 'broken'
	>('checking');
	const [isRepairing, setIsRepairing] = useState(false);
	const [refreshFailed, setRefreshFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadDirectoryHandle(siteSlug)
			.then(async (handle) => {
				const readiness = await probeDirectoryHandle(handle);
				if (!cancelled) {
					setFolderName(handle.name);
					setFolderAccess(readiness === 'ready' ? 'ok' : 'broken');
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFolderAccess('broken');
				}
			});
		return () => {
			cancelled = true;
		};
	}, [siteSlug]);

	const refreshFromFolder = async () => {
		setRefreshFailed(false);
		if (await reloadFromDisk()) {
			return;
		}
		// A failed refresh either means the browser lost folder access or a
		// transient runtime problem; probing tells the two apart.
		try {
			const handle = await loadDirectoryHandle(siteSlug);
			if ((await probeDirectoryHandle(handle)) !== 'ready') {
				setFolderAccess('broken');
				return;
			}
		} catch {
			setFolderAccess('broken');
			return;
		}
		setRefreshFailed(true);
	};

	// Re-requests the browser permission; must run inside the click gesture.
	const allowAccess = async () => {
		setIsRepairing(true);
		try {
			const handle = await loadDirectoryHandle(siteSlug);
			const permission = await requestDirectoryHandlePermission(handle);
			if (
				permission === 'granted' &&
				(await probeDirectoryHandle(handle)) === 'ready'
			) {
				setFolderAccess('ok');
				// Finish what the user came for: show the folder's current
				// files now that access is back.
				await reloadFromDisk();
			}
		} catch (cause) {
			logger.error('Error restoring local folder access.', cause);
		} finally {
			setIsRepairing(false);
		}
	};

	const bootConfiguration = siteInfo.metadata.localDirectoryBootConfiguration;

	return (
		<div className={css.rows}>
			<div className={css.row}>
				<span className={css.label}>Local folder</span>
				<span className={css.value}>
					<span className={css.folderName}>
						{folderName ?? siteInfo.metadata.name}
					</span>
					{folderAccess === 'broken' ? (
						<>
							<span className={css.feedbackError}>
								Playground lost access to this folder.
							</span>
							<Button
								variant="link"
								disabled={isRepairing}
								onClick={() => void allowAccess()}
							>
								{isRepairing ? 'Waiting…' : 'Allow access'}
							</Button>
						</>
					) : (
						<Button
							variant="link"
							disabled={isReloading || folderAccess !== 'ok'}
							onClick={() => void refreshFromFolder()}
						>
							{isReloading
								? 'Refreshing…'
								: 'Refresh from folder'}
						</Button>
					)}
				</span>
			</div>
			{bootConfiguration ? (
				<div className={css.row}>
					<span className={css.label}>Document root</span>
					<span className={css.value}>
						<code>
							{getLocalDirectoryPickerPath(
								bootConfiguration.documentRoot
							)}
						</code>
						<Button
							variant="link"
							onClick={() => void documentRootPicker.openPicker()}
						>
							Change
						</Button>
					</span>
				</div>
			) : null}
			{documentRootPicker.error || refreshFailed ? (
				<div className={css.row}>
					<span aria-hidden="true" />
					<span className={css.value}>
						{documentRootPicker.error ? (
							<p className={css.feedbackError} role="alert">
								{documentRootPicker.error}
							</p>
						) : null}
						{refreshFailed ? (
							<p className={css.feedbackError} role="alert">
								Couldn’t refresh the files. Try again.
							</p>
						) : null}
					</span>
				</div>
			) : null}
			{documentRootPicker.directoryHandle && bootConfiguration ? (
				<LocalDirectoryDocumentRootModal
					directoryHandle={documentRootPicker.directoryHandle}
					initialDocumentRoot={bootConfiguration.documentRoot}
					onRequestClose={documentRootPicker.closePicker}
					onSelect={async (documentRoot) => {
						await sitesAPI.changeLocalDirectoryDocumentRoot(
							documentRoot
						);
						documentRootPicker.closePicker();
					}}
				/>
			) : null}
		</div>
	);
}
