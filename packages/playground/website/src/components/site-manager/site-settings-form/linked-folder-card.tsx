import { useEffect, useState } from 'react';
import { Button, Icon } from '@wordpress/components';
import { archive } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import css from './linked-folder-card.module.css';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteSlugToDelete,
} from '../../../lib/state/redux/slice-ui';
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
 * The one place that shows everything about a Playground's linked local
 * folder: which folder it is, what PHP serves from it, and the actions that
 * operate on the link itself.
 */
export function LinkedFolderCard({ siteSlug }: { siteSlug: string }) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const dispatch = useAppDispatch();
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

	const removeFromPlayground = () => {
		dispatch(setSiteSlugToDelete(siteSlug));
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
	};

	return (
		<div className={css.card}>
			<h4 className={css.title}>Local folder</h4>
			<div className={css.folderRow}>
				<Icon icon={archive} size={20} />
				<span className={css.folderName}>
					{folderName ?? siteInfo.metadata.name}
				</span>
			</div>
			<p className={css.hint}>
				Playground reads and writes the files in this folder. Changes
				made here appear on disk, and you can keep editing the files
				with any other tool.
			</p>
			{bootConfiguration ? (
				<div className={css.documentRootRow}>
					<span>
						Document root:{' '}
						<code>
							{getLocalDirectoryPickerPath(
								bootConfiguration.documentRoot
							)}
						</code>
					</span>
					<Button
						variant="link"
						onClick={() => void documentRootPicker.openPicker()}
					>
						Change
					</Button>
				</div>
			) : null}
			<div className={css.actions}>
				<Button
					variant="secondary"
					size="compact"
					isBusy={isReloading}
					disabled={isReloading}
					onClick={() => void reloadFromDisk()}
				>
					{isReloading ? 'Reloading…' : 'Reload files from disk'}
				</Button>
				<Button
					variant="tertiary"
					size="compact"
					isBusy={isReconnecting}
					disabled={isReconnecting}
					onClick={() => void reconnectFolder()}
				>
					Reconnect
				</Button>
				<Button
					className={css.removeAction}
					variant="tertiary"
					size="compact"
					isDestructive
					onClick={removeFromPlayground}
				>
					Remove from Playground…
				</Button>
			</div>
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
					role={feedback.type === 'error' ? 'alert' : 'status'}
				>
					{feedback.message}
				</p>
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
