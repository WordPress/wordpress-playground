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
 * side-label geometry. Deleting the link lives in the Playgrounds pane, not
 * here.
 */
export function LinkedFolderCard({ siteSlug }: { siteSlug: string }) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const sitesAPI = useSitesAPI();
	const { reloadFromDisk, isReloading } = useReloadFromDisk();
	const documentRootPicker = useDocumentRootPicker();
	const [folderName, setFolderName] = useState<string | null>(null);
	const [isReconnecting, setIsReconnecting] = useState(false);
	const [feedback, setFeedback] = useState<{
		type: 'success' | 'error';
		message: string;
	} | null>(null);

	const bootConfiguration = siteInfo.metadata.localDirectoryBootConfiguration;

	useEffect(() => {
		let cancelled = false;
		loadDirectoryHandle(siteSlug)
			.then((handle) => {
				if (!cancelled) {
					setFolderName(handle.name);
				}
			})
			.catch(() => {
				// The handle may be gone; the boot flow offers the recovery UI.
			});
		return () => {
			cancelled = true;
		};
	}, [siteSlug]);

	const reconnectFolder = async () => {
		setFeedback(null);
		setIsReconnecting(true);
		try {
			const handle = await loadDirectoryHandle(siteSlug);
			const permission = await requestDirectoryHandlePermission(handle);
			if (
				permission !== 'granted' ||
				(await probeDirectoryHandle(handle)) !== 'ready'
			) {
				setFeedback({
					type: 'error',
					message:
						'The folder could not be accessed. Reopen it from the Playgrounds pane.',
				});
				return;
			}
			setFeedback({
				type: 'success',
				message: 'Folder access confirmed.',
			});
		} catch (cause) {
			logger.error('Error reconnecting the local folder.', cause);
			setFeedback({
				type: 'error',
				message:
					'The folder could not be accessed. Reopen it from the Playgrounds pane.',
			});
		} finally {
			setIsReconnecting(false);
		}
	};

	return (
		<div className={css.rows}>
			<div className={css.row}>
				<span className={css.label}>Local folder</span>
				<span className={css.value}>
					<span className={css.folderName}>
						{folderName ?? siteInfo.metadata.name}
					</span>
					{/* The action pair wraps as one unit so a narrow pane
					    never strands a lone link on its own line. */}
					<span className={css.actionPair}>
						<Button
							variant="link"
							disabled={isReloading}
							onClick={() => void reloadFromDisk()}
						>
							{isReloading ? 'Reloading…' : 'Reload from disk'}
						</Button>
						<Button
							variant="link"
							disabled={isReconnecting}
							onClick={() => void reconnectFolder()}
						>
							{isReconnecting ? 'Reconnecting…' : 'Reconnect'}
						</Button>
					</span>
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
			{documentRootPicker.error || feedback ? (
				<div className={css.row}>
					<span aria-hidden="true" />
					<span className={css.value}>
						{documentRootPicker.error ? (
							<p className={css.feedbackError} role="alert">
								{documentRootPicker.error}
							</p>
						) : null}
						{feedback ? (
							<p
								className={
									feedback.type === 'error'
										? css.feedbackError
										: css.feedbackSuccess
								}
								role={
									feedback.type === 'error'
										? 'alert'
										: 'status'
								}
							>
								{feedback.message}
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
