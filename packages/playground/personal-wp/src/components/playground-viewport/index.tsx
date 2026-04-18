import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import Button from '../button';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const PlaygroundViewport = () => {
	const activeSite = useActiveSite();
	return activeSite ? (
		<SeamlessViewport siteSlug={activeSite.slug} />
	) : null;
};

function SeamlessViewport({ siteSlug }: { siteSlug: string }) {
	const dispatch = useAppDispatch();
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
				const response = await fetch(blueprintUrl);
				const blueprint = await response.json();
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
			if (
				typeof event.data === 'object' &&
				event.data?.type === 'relay' &&
				event.data?.relayType === 'install-blueprint' &&
				event.data?.blueprintUrl
			) {
				applyBlueprint(event.data.blueprintUrl);
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

	return (
		<div className={css.seamlessWrapper}>
			{installingBlueprint && (
				<div className={css.installBanner}>{installingBlueprint}</div>
			)}
			<JustViewport siteSlug={siteSlug} />

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

export const JustViewport = function JustViewport({
	siteSlug,
}: {
	siteSlug: string;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
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
