import React, { useEffect, useRef } from 'react';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import {
	selectActiveSiteError,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import { SiteError } from '../../lib/state/redux/slice-ui';
import { Button } from '@wordpress/components';
import { removeSite } from '../../lib/state/redux/slice-sites';

export const supportedDisplayModes = [
	'browser-full-screen',
	'seamless',
] as const;
export type DisplayMode = (typeof supportedDisplayModes)[number];
interface PlaygroundViewportProps {
	displayMode?: DisplayMode;
	children?: React.ReactNode;
	siteSlug?: string;
	hideToolbar?: boolean;
	className?: string;
}

export const PlaygroundViewport = ({
	displayMode = 'browser-full-screen',
	hideToolbar,
	className,
}: PlaygroundViewportProps) => {
	if (displayMode === 'seamless') {
		// No need to boot the playground if seamless.
		return <JustViewport />;
	}
	return (
		<BrowserChrome hideToolbar={hideToolbar} className={className}>
			<JustViewport />
		</BrowserChrome>
	);
};

export const JustViewport = function LoadedViewportComponent() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const activeSite = useActiveSite()!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		activeSite.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		const abortController = new AbortController();
		dispatch(
			bootSiteClient(activeSite.slug, iframe, {
				signal: abortController.signal,
			})
		);

		return () => {
			abortController.abort();
			dispatch(removeClientInfo(activeSite.slug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSite.slug, iframeRef, runtimeConfigString]);

	const error = useAppSelector(selectActiveSiteError);

	if (error) {
		return (
			<div className={css.fullSize}>
				<div className={css.siteError}>
					<div className={css.siteErrorContent}>
						<SiteErrorMessage
							error={error}
							siteSlug={activeSite.slug}
						/>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={css.fullSize}>
			<iframe
				id="playground-viewport"
				key={activeSite.slug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};

function SiteErrorMessage({
	error,
	siteSlug,
}: {
	error: SiteError;
	siteSlug: string;
}) {
	const dispatch = useAppDispatch();
	if (
		error === 'directory-handle-not-found-in-indexeddb' ||
		error === 'directory-handle-permission-denied'
	) {
		/**
		 * Displayed either when the directory permissions truly expired OR when we
		 * expected to find the directory handle in IndexedDB, but it wasn't actually there.
		 *
		 * In the latter scenario, this error message states an untrue failure reason. This
		 * is to keep things simple. We don't want to start explaining IndexedDB, OPFS handles
		 * etc. What matters is that the directory handle is gone and the site won't work until
		 * the user to provide a new one.
		 */
		return (
			<>
				<h1>Local directory permissions expired</h1>
				<p>
					You previously granted WordPress Playground access to your
					local directory, but the browser no longer allows Playground
					to access it.
				</p>
				<p>
					There's no way to recover from this today. We are working on
					a way of selecting the local directory again. Stay tuned,
					and if you urgently need to work with this site, tell us at{' '}
					<a
						target="_blank"
						rel="noopener noreferrer"
						href="https://github.com/WordPress/wordpress-playground/issues/1746"
					>
						GitHub
					</a>
					.
				</p>
			</>
		);
	}

	if (error === 'directory-handle-directory-does-not-exist') {
		return (
			<>
				<h1>Local directory was deleted</h1>
				<p>
					It seems like you deleted the local directory you previously
					selected.
				</p>
				<p>Unforunately, this site won't work anymore.</p>
				<Button
					onClick={() => {
						dispatch(removeSite(siteSlug));
						dispatch(removeClientInfo(siteSlug));
					}}
				>
					Delete this site
				</Button>
			</>
		);
	}

	return (
		<>
			<h1>Something went wrong</h1>
			<p>An error occurred while loading your site. Please try again.</p>
			<Button
				onClick={() => {
					window.location.reload();
				}}
			>
				Reload the browser tab to try again
			</Button>
		</>
	);
}
