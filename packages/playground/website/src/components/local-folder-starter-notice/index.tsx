import { useEffect, useState } from 'react';
import { Button } from '@wordpress/components';
import { close } from '@wordpress/icons';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import css from './style.module.css';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';
import { selectClientInfoBySiteSlug } from '../../lib/state/redux/slice-clients';
import {
	setDockPaneOpen,
	setDockPaneSection,
} from '../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { useDocumentRootPicker } from '../../lib/hooks/use-local-folder';
import {
	getLocalDirectoryDocumentRoot,
	getLocalDirectoryPickerPath,
	isLocalDirectoryPhpApp,
} from '../../lib/local-directory-site';
import { LocalDirectoryDocumentRootModal } from '../local-directory-document-root-modal';

/**
 * Dismissals survive component remounts (e.g. Dock pane toggles) but reset per
 * document root: pointing PHP at another folder is a fresh serving decision.
 */
const dismissedNotices = new Set<string>();

/**
 * First-run help for a PHP-mode local folder whose document root has no
 * index.php. A bare 404 tells a user who just opened an empty folder nothing;
 * this offers the three ways forward, each of which already exists elsewhere.
 */
export function LocalFolderStarterNotice({ site }: { site: SiteInfo }) {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const documentRootPicker = useDocumentRootPicker();
	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const [missingIndexPhp, setMissingIndexPhp] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string>();
	const [dismissedVersion, setDismissedVersion] = useState(0);

	const bootConfiguration = site.metadata.localDirectoryBootConfiguration;
	const isPhpApp = isLocalDirectoryPhpApp(bootConfiguration);
	const client = clientInfo?.client;
	const documentRootPath =
		isPhpApp && bootConfiguration
			? getLocalDirectoryDocumentRoot(bootConfiguration)
			: undefined;
	const dismissalKey = `${site.slug}:${documentRootPath ?? ''}`;

	useEffect(() => {
		if (!client || !documentRootPath) {
			setMissingIndexPhp(false);
			return;
		}
		let cancelled = false;
		client
			.fileExists(joinPaths(documentRootPath, 'index.php'))
			.then((exists) => {
				if (!cancelled) {
					setMissingIndexPhp(!exists);
				}
			})
			.catch(() => {
				// An unreachable runtime has bigger problems than this notice.
			});
		return () => {
			cancelled = true;
		};
	}, [client, documentRootPath]);

	if (
		!missingIndexPhp ||
		!client ||
		!documentRootPath ||
		!bootConfiguration ||
		dismissedNotices.has(dismissalKey)
	) {
		return null;
	}
	// Reference so dismissing re-renders even though the set is module-level.
	void dismissedVersion;

	const createIndexPhp = async () => {
		setError(undefined);
		setIsCreating(true);
		try {
			await client.writeFile(
				joinPaths(documentRootPath, 'index.php'),
				`<?php\n\necho "Hello from ${site.metadata.name}!";\n`
			);
			await client.goTo(clientInfo?.url ?? '/');
			setMissingIndexPhp(false);
		} catch (cause) {
			logger.error('Error creating index.php.', cause);
			setError('The file could not be created.');
		} finally {
			setIsCreating(false);
		}
	};

	const openFileEditor = () => {
		dispatch(setDockPaneSection('files'));
		dispatch(setDockPaneOpen(true));
	};

	const dismiss = () => {
		dismissedNotices.add(dismissalKey);
		setDismissedVersion((version) => version + 1);
	};

	const servedPath = getLocalDirectoryPickerPath(
		bootConfiguration.documentRoot
	);

	return (
		<div className={css.overlay}>
			<div
				className={css.card}
				role="status"
				aria-label="This folder has no index.php yet"
			>
				<Button
					className={css.dismiss}
					icon={close}
					size="small"
					label="Dismiss"
					onClick={dismiss}
				/>
				<h2 className={css.title}>This folder has no index.php yet</h2>
				<p className={css.body}>
					PHP is serving <code>{servedPath}</code>, but there is no{' '}
					<code>index.php</code> in it to run. Create one, edit the
					files, or serve a different folder.
				</p>
				{error ? (
					<p className={css.error} role="alert">
						{error}
					</p>
				) : null}
				{documentRootPicker.error ? (
					<p className={css.error} role="alert">
						{documentRootPicker.error}
					</p>
				) : null}
				<div className={css.actions}>
					<Button
						variant="primary"
						size="compact"
						isBusy={isCreating}
						disabled={isCreating}
						onClick={() => void createIndexPhp()}
					>
						Create index.php
					</Button>
					<Button
						variant="secondary"
						size="compact"
						onClick={openFileEditor}
					>
						Open the file editor
					</Button>
					<Button
						variant="tertiary"
						size="compact"
						onClick={() => void documentRootPicker.openPicker()}
					>
						Change document root
					</Button>
				</div>
			</div>
			{documentRootPicker.directoryHandle ? (
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
