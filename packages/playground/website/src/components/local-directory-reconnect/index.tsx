import { useEffect, useState } from 'react';
import { Button, Icon } from '@wordpress/components';
import { archive } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import css from './style.module.css';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import type { LocalDirectoryReconnectState } from '../../lib/state/redux/slice-ui';
import {
	clearLocalDirectoryReconnect,
	retrySiteBoot,
} from '../../lib/state/redux/slice-ui';
import { useAppDispatch } from '../../lib/state/redux/store';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { loadDirectoryHandle } from '../../lib/state/opfs/opfs-directory-handle-storage';
import {
	probeDirectoryHandle,
	requestDirectoryHandlePermission,
	showLocalFolderPicker,
} from '../../lib/local-directory-handle';

/**
 * Shown instead of booting when a local-folder Playground cannot use its
 * stored directory handle. Repairs the handle in place — re-granting the
 * browser permission or picking the folder again — and then resumes the same
 * boot rather than surfacing a crash.
 */
export function LocalDirectoryReconnectOverlay({
	site,
	reconnect,
}: {
	site: SiteInfo;
	reconnect: LocalDirectoryReconnectState;
}) {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const [storedHandle, setStoredHandle] =
		useState<FileSystemDirectoryHandle | null>(null);
	// A picked folder whose name differs from the linked one awaits an
	// explicit confirmation before it replaces the stored handle.
	const [handleAwaitingConfirmation, setHandleAwaitingConfirmation] =
		useState<FileSystemDirectoryHandle | null>(null);
	const [error, setError] = useState<string>();
	const [isBusy, setIsBusy] = useState(false);

	const canReuseStoredHandle = reconnect.reason === 'needs-permission';

	// Load the stored handle ahead of the click so the permission request runs
	// as the gesture's first async step and stays within the activation window.
	useEffect(() => {
		if (!canReuseStoredHandle) {
			return;
		}
		let cancelled = false;
		loadDirectoryHandle(site.slug)
			.then((handle) => {
				if (!cancelled) {
					setStoredHandle(handle);
				}
			})
			.catch((cause) => {
				logger.error('Error loading the local folder handle.', cause);
			});
		return () => {
			cancelled = true;
		};
	}, [canReuseStoredHandle, site.slug]);

	const resumeBoot = () => {
		dispatch(clearLocalDirectoryReconnect());
		dispatch(retrySiteBoot(site.slug));
	};

	const reconnectStoredFolder = async () => {
		if (!storedHandle) {
			return;
		}
		setError(undefined);
		setIsBusy(true);
		try {
			const permission =
				await requestDirectoryHandlePermission(storedHandle);
			if (permission !== 'granted') {
				setError(
					'Your browser did not allow access. Try again, or choose the folder yourself.'
				);
				return;
			}
			if ((await probeDirectoryHandle(storedHandle)) !== 'ready') {
				setError(
					"The folder still can't be read. Choose it again to continue."
				);
				return;
			}
			resumeBoot();
		} catch (cause) {
			logger.error('Error reconnecting the local folder.', cause);
			setError(
				'Reconnecting failed. Try again, or choose the folder yourself.'
			);
		} finally {
			setIsBusy(false);
		}
	};

	const chooseFolder = async () => {
		setError(undefined);
		try {
			const pickedHandle = await showLocalFolderPicker();
			const permission =
				await requestDirectoryHandlePermission(pickedHandle);
			if (permission !== 'granted') {
				setError('Playground needs permission to use that folder.');
				return;
			}
			const linkedFolderName = reconnect.folderName;
			if (linkedFolderName && pickedHandle.name !== linkedFolderName) {
				setHandleAwaitingConfirmation(pickedHandle);
				return;
			}
			await relinkFolder(pickedHandle);
		} catch (cause) {
			if ((cause as DOMException | undefined)?.name === 'AbortError') {
				return;
			}
			logger.error('Error choosing a local folder.', cause);
			setError('The selected folder could not be opened.');
		}
	};

	const relinkFolder = async (handle: FileSystemDirectoryHandle) => {
		setIsBusy(true);
		try {
			await sitesAPI.relinkLocalDirectory(site.slug, handle);
			resumeBoot();
		} catch (cause) {
			logger.error('Error relinking the local folder.', cause);
			setHandleAwaitingConfirmation(null);
			setError('The selected folder could not be opened.');
		} finally {
			setIsBusy(false);
		}
	};

	const lead = getReconnectLead(site, reconnect);

	return (
		<div className={css.overlay}>
			<div
				className={css.card}
				role="alertdialog"
				aria-label={lead.title}
			>
				<Icon icon={archive} size={36} className={css.icon} />
				<h2 className={css.title}>{lead.title}</h2>
				<p className={css.lead}>{lead.body}</p>
				{error ? (
					<p className={css.error} role="alert">
						{error}
					</p>
				) : null}
				{handleAwaitingConfirmation ? (
					<>
						<p className={css.lead}>
							You picked “{handleAwaitingConfirmation.name}”, but
							this Playground was linked to “
							{reconnect.folderName}”.
						</p>
						<div className={css.actions}>
							<Button
								variant="primary"
								isBusy={isBusy}
								disabled={isBusy}
								onClick={() =>
									void relinkFolder(
										handleAwaitingConfirmation
									)
								}
							>
								Use “{handleAwaitingConfirmation.name}” anyway
							</Button>
							<Button
								variant="tertiary"
								disabled={isBusy}
								onClick={() =>
									setHandleAwaitingConfirmation(null)
								}
							>
								Cancel
							</Button>
						</div>
					</>
				) : (
					<div className={css.actions}>
						{canReuseStoredHandle ? (
							<Button
								variant="primary"
								isBusy={isBusy}
								disabled={isBusy || !storedHandle}
								onClick={() => void reconnectStoredFolder()}
							>
								Reconnect folder
							</Button>
						) : (
							<Button
								variant="primary"
								isBusy={isBusy}
								disabled={isBusy}
								onClick={() => void chooseFolder()}
							>
								Choose the folder…
							</Button>
						)}
						{canReuseStoredHandle ? (
							<Button
								variant="tertiary"
								disabled={isBusy}
								onClick={() => void chooseFolder()}
							>
								Choose a different folder…
							</Button>
						) : null}
					</div>
				)}
				<p className={css.reassurance}>
					Your files stay on this computer. Playground reads and
					writes them directly.
				</p>
			</div>
		</div>
	);
}

function getReconnectLead(
	site: SiteInfo,
	reconnect: LocalDirectoryReconnectState
): { title: string; body: string } {
	const siteName = site.metadata.name;
	const folderName = reconnect.folderName;
	switch (reconnect.reason) {
		case 'needs-permission':
			return {
				title: 'Reconnect the local folder',
				body: `${siteName} runs from ${
					folderName ? `the folder “${folderName}”` : 'a folder'
				} on this computer. Your browser needs a quick confirmation before Playground can use it again.`,
			};
		case 'missing-directory':
			return {
				title: 'The local folder is missing',
				body: `The folder ${
					folderName ? `“${folderName}” ` : ''
				}can't be found. It may have been moved, renamed, or deleted. Choose it again to continue.`,
			};
		case 'missing-handle':
		default:
			return {
				title: 'Choose the local folder again',
				body: `${siteName} runs from a folder on this computer, but your browser no longer remembers which one. Choose the folder to continue.`,
			};
	}
}
