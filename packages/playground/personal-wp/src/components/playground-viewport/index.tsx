import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
	type BlueprintV1Declaration,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { ProgressTracker } from '@php-wasm/progress';

import css from './style.module.css';
import {
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import { selectSiteBySlug } from '../../lib/state/redux/slice-sites';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { playgroundLogo } from '@wp-playground/components';
import { isAppBasePath } from '../../lib/state/url/app-base-url';
import Button from '../button';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const PlaygroundViewport = () => {
	const activeSite = useActiveSite();
	return activeSite ? <SeamlessViewport siteSlug={activeSite.slug} /> : null;
};

function SeamlessViewport({ siteSlug }: { siteSlug: string }) {
	const dispatch = useAppDispatch();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const clientInfo = useAppSelector(getActiveClientInfo);
	const url = clientInfo?.url;
	const playground = clientInfo?.client;

	const [installingBlueprint, setInstallingBlueprint] = useState<
		string | null
	>(null);

	// Apply a blueprint in-place on the running instance.
	const applyBlueprint = useCallback(
		async (blueprintUrl: string) => {
			if (!playground) {
				return;
			}
			try {
				setInstallingBlueprint('Installing\u2026');
				const blueprint = await fetchBlueprint(blueprintUrl);
				const title = blueprint.meta?.title || 'app';
				setInstallingBlueprint(`Installing ${title}\u2026`);

				const progress = new ProgressTracker();
				progress.addEventListener('progress', ((e: CustomEvent) => {
					const caption = e.detail?.caption;
					if (caption) {
						setInstallingBlueprint(caption);
					}
				}) as EventListener);

				const compiled = await compileBlueprintV1(blueprint, {
					corsProxy: corsProxyUrl,
					progress,
				});
				await runBlueprintV1Steps(compiled, playground);
				if (blueprint.landingPage) {
					await playground.goTo(blueprint.landingPage);
				}
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('Failed to apply blueprint:', e);
				setInstallingBlueprint('Installation failed');
				setTimeout(() => setInstallingBlueprint(null), 3000);
				return;
			}
			setInstallingBlueprint(null);
		},
		[playground]
	);

	// Handle install-blueprint relay messages from WordPress plugins.
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (isInstallBlueprintMessage(event, iframeRef.current)) {
				if (confirmBlueprintInstall(event.data.blueprintUrl)) {
					applyBlueprint(event.data.blueprintUrl);
				}
			}
		}
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, [applyBlueprint]);

	// Reflect the WordPress URL in the browser's address bar.
	useEffect(() => {
		if (!url) {
			return;
		}
		const browserUrl =
			window.location.origin + (url.startsWith('/') ? url : '/' + url);
		if (browserUrl !== window.location.href) {
			window.history.pushState({}, '', browserUrl);
		}
	}, [url]);

	useEffect(() => {
		if (!playground) {
			return;
		}
		function handlePopState() {
			const pathname = isAppBasePath(window.location.pathname)
				? '/'
				: window.location.pathname;
			void playground?.goTo(pathname + window.location.search);
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [playground]);

	return (
		<div className={css.seamlessWrapper}>
			{installingBlueprint && (
				<div className={css.installBanner}>{installingBlueprint}</div>
			)}
			<JustViewport siteSlug={siteSlug} iframeRef={iframeRef} />

			<div
				className={classNames(css.sidebarLatch, {
					[css.sidebarLatchHidden]: siteManagerIsOpen,
				})}
			>
				<Button
					variant="browser-chrome"
					aria-label={
						siteManagerIsOpen
							? 'Close Site Tools'
							: 'Open Site Tools'
					}
					aria-pressed={siteManagerIsOpen}
					className={css.sidebarLatchButton}
					onClick={() => {
						dispatch(setSiteManagerOpen(!siteManagerIsOpen));
					}}
				>
					{playgroundLogo({ width: 24, height: 24 })}
				</Button>
			</div>
		</div>
	);
}

function confirmBlueprintInstall(blueprintUrl: string): boolean {
	const url = new URL(blueprintUrl);
	const source = url.protocol === 'data:' ? 'an inline blueprint' : url.host;
	return window.confirm(
		`Install an app from ${source}? This may change your WordPress site.`
	);
}

type InstallBlueprintMessage = MessageEvent<{
	type: 'relay';
	relayType: 'install-blueprint';
	blueprintUrl: string;
}>;

async function fetchBlueprint(
	blueprintUrl: string
): Promise<BlueprintV1Declaration> {
	const response = await fetch(blueprintUrl);
	if (!response.ok) {
		throw new Error(
			`Could not download blueprint: ${response.status} ${response.statusText}`
		);
	}
	try {
		return (await response.json()) as BlueprintV1Declaration;
	} catch (e) {
		throw new Error('Blueprint response was not valid JSON.', {
			cause: e,
		});
	}
}

function isInstallBlueprintMessage(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): event is InstallBlueprintMessage {
	if (
		!iframe?.contentWindow ||
		event.source !== iframe.contentWindow ||
		event.origin !== window.location.origin ||
		typeof event.data !== 'object' ||
		event.data === null
	) {
		return false;
	}
	const data = event.data as Partial<InstallBlueprintMessage['data']>;
	return (
		data.type === 'relay' &&
		data.relayType === 'install-blueprint' &&
		isAllowedBlueprintUrl(data.blueprintUrl)
	);
}

function isAllowedBlueprintUrl(blueprintUrl: unknown): blueprintUrl is string {
	if (typeof blueprintUrl !== 'string') {
		return false;
	}
	try {
		const url = new URL(blueprintUrl);
		return (
			url.protocol === 'https:' ||
			url.protocol === 'data:' ||
			(url.protocol === 'http:' && isLocalhost(url.hostname))
		);
	} catch {
		return false;
	}
}

function isLocalhost(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '::1' ||
		hostname === '[::1]'
	);
}

export const JustViewport = function JustViewport({
	siteSlug,
	iframeRef: externalIframeRef,
}: {
	siteSlug: string;
	iframeRef?: RefObject<HTMLIFrameElement>;
}) {
	const internalIframeRef = useRef<HTMLIFrameElement>(null);
	const iframeRef = externalIframeRef || internalIframeRef;
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug))!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		site.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		const abortController = new AbortController();
		dispatch(
			bootSiteClient(siteSlug, iframe, {
				signal: abortController.signal,
				clearUrlAfterBlueprintApplied: true,
				autoLogin: true,
			})
		);

		return () => {
			abortController.abort();
			dispatch(removeClientInfo(siteSlug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, iframeRef, runtimeConfigString]);

	const error = useAppSelector(selectActiveSiteError);
	const errorDetails = useAppSelector(selectActiveSiteErrorDetails);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	const showOverlay = error && activeSiteSlug === siteSlug;

	return (
		<>
			<iframe
				key={siteSlug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={classNames('playground-viewport', css.fullSize)}
				ref={iframeRef}
			/>
			{showOverlay ? (
				<SiteErrorModal
					error={error}
					siteSlug={siteSlug}
					site={site}
					errorDetails={errorDetails}
				/>
			) : null}
		</>
	);
};
