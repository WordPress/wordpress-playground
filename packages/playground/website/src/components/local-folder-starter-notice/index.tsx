import { useEffect, useState } from 'react';
import { Button, Icon } from '@wordpress/components';
import { close, page } from '@wordpress/icons';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import classNames from 'classnames';
import css from './style.module.css';
import calloutCss from '../dock-callout.module.css';
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
 * Wears the shared Dock-callout anatomy so it reads as kin to the On disk and
 * autosave callouts.
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
			<aside
				className={classNames(calloutCss.surface, calloutCss.card)}
				role="status"
				aria-label="No index.php yet"
			>
				<div className={calloutCss.header}>
					<div className={calloutCss.eyebrow}>Local folder</div>
					<Button
						className={calloutCss.dismiss}
						icon={close}
						label="Dismiss"
						onClick={dismiss}
					/>
				</div>
				<div className={calloutCss.identity}>
					<span className={calloutCss.avatar} aria-hidden="true">
						<Icon icon={page} size={28} />
					</span>
					<div className={calloutCss.identityCopy}>
						<div className={calloutCss.identityTitle}>
							No index.php yet
						</div>
						<div className={calloutCss.identityMeta}>
							PHP is serving{' '}
							<code className={css.code}>{servedPath}</code>
						</div>
					</div>
				</div>
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
				<Button
					variant="primary"
					className={calloutCss.primaryAction}
					isBusy={isCreating}
					disabled={isCreating}
					onClick={() => void createIndexPhp()}
				>
					Create index.php
				</Button>
				<div className={css.footerActions}>
					<Button variant="link" onClick={openFileEditor}>
						Open the file editor
					</Button>
					<Button
						variant="link"
						onClick={() => void documentRootPicker.openPicker()}
					>
						Change document root
					</Button>
				</div>
			</aside>
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
