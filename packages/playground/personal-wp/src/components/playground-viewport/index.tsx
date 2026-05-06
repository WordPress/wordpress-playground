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
	const isDependentMode = clientInfo?.isDependentMode ?? false;
	const canInstallBlueprint = !!playground && !isDependentMode;

	const [installingBlueprint, setInstallingBlueprint] = useState<
		string | null
	>(null);

	// Apply a blueprint in-place on the running instance.
	const applyBlueprint = useCallback(
		async (blueprintUrl: string): Promise<InstallBlueprintResult> => {
			if (!playground) {
				return {
					status: 'error',
					error: 'Playground is not ready.',
				};
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
				await runBlueprintV1Steps(
					compiled,
					getBlueprintRunnerClient(playground, blueprint)
				);
				if (blueprint.landingPage) {
					await playground.goTo(blueprint.landingPage);
				}
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('Failed to apply blueprint:', e);
				setInstallingBlueprint('Installation failed');
				setTimeout(() => setInstallingBlueprint(null), 3000);
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
			setInstallingBlueprint(null);
			return { status: 'success' };
		},
		[playground]
	);

	// Handle relay messages from WordPress plugins.
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			const relayValidation = getRelayMessageValidation(
				event,
				iframeRef.current
			);
			if (!relayValidation.isValid) {
				return;
			}

			const windowStateMessage = getPlaygroundWindowStateMessageData(
				relayValidation.data
			);
			if (windowStateMessage) {
				postPlaygroundWindowState(event, {
					requestId: windowStateMessage.requestId,
					isDependentMode,
					canInstallBlueprint,
				});
				return;
			}

			const installBlueprintMessage = getInstallBlueprintMessageData(
				relayValidation.data
			);
			if (installBlueprintMessage) {
				void installBlueprintFromRelay(event, installBlueprintMessage);
			}
		}
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	}, [applyBlueprint, canInstallBlueprint, isDependentMode, siteSlug]);

	async function installBlueprintFromRelay(
		event: MessageEvent,
		message: InstallBlueprintMessageData
	) {
		const { blueprintUrl, requestId } = message;
		if (isDependentMode) {
			postInstallBlueprintResult(event, {
				blueprintUrl,
				requestId,
				status: 'error',
				error: 'This tab is viewing a site controlled by another tab.',
			});
			return;
		}

		if (!confirmBlueprintInstall(blueprintUrl)) {
			postInstallBlueprintResult(event, {
				blueprintUrl,
				requestId,
				status: 'cancelled',
			});
			return;
		}

		postInstallBlueprintResult(event, {
			blueprintUrl,
			requestId,
			...(await applyBlueprint(blueprintUrl)),
		});
	}

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

type RelayMessageData = {
	type: 'relay';
	relayType?: unknown;
	blueprintUrl?: unknown;
	requestId?: unknown;
};

type InstallBlueprintMessageData = {
	type: 'relay';
	relayType: 'install-blueprint';
	blueprintUrl: string;
	requestId?: string;
};

type PlaygroundWindowStateMessageData = {
	type: 'relay';
	relayType: 'get-playground-window-state';
	requestId?: string;
};

type InstallBlueprintResult = {
	status: 'success' | 'error';
	error?: string;
};

type InstallBlueprintResultMessage = {
	type: 'relay';
	relayType: 'install-blueprint-result';
	blueprintUrl: string;
	requestId?: string;
	status: InstallBlueprintResult['status'] | 'cancelled';
	error?: string;
};

type PlaygroundWindowStateResultMessage = {
	type: 'relay';
	relayType: 'playground-window-state';
	requestId?: string;
	isDependentMode: boolean;
	canInstallBlueprint: boolean;
};

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

function getRelayMessageValidation(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
):
	| {
			isValid: true;
			data: RelayMessageData;
	  }
	| {
			isValid: false;
			reason: string;
			data?: Partial<RelayMessageData>;
	  } {
	if (typeof event.data !== 'object' || event.data === null) {
		return { isValid: false, reason: 'invalid-data' };
	}
	const data = event.data as Partial<RelayMessageData>;
	if (data.type !== 'relay') {
		return { isValid: false, reason: 'not-relay', data };
	}
	if (!isMessageFromIframeTree(event, iframe)) {
		return { isValid: false, reason: 'unexpected-source', data };
	}
	if (event.origin !== window.location.origin) {
		return { isValid: false, reason: 'unexpected-origin', data };
	}
	return { isValid: true, data: { type: 'relay', ...data } };
}

function getInstallBlueprintMessageData(
	data: RelayMessageData
): InstallBlueprintMessageData | undefined {
	if (
		data.relayType !== 'install-blueprint' ||
		!isAllowedBlueprintUrl(data.blueprintUrl)
	) {
		return;
	}
	return {
		type: 'relay',
		relayType: 'install-blueprint',
		blueprintUrl: data.blueprintUrl,
		requestId: getRequestId(data),
	};
}

function getPlaygroundWindowStateMessageData(
	data: RelayMessageData
): PlaygroundWindowStateMessageData | undefined {
	if (data.relayType === 'get-playground-window-state') {
		return {
			type: 'relay',
			relayType: 'get-playground-window-state',
			requestId: getRequestId(data),
		};
	}
	return;
}

function getRequestId(data: RelayMessageData): string | undefined {
	return typeof data.requestId === 'string' ? data.requestId : undefined;
}

function postInstallBlueprintResult(
	event: MessageEvent,
	result: Omit<InstallBlueprintResultMessage, 'type' | 'relayType'>
) {
	if (!event.source) {
		return;
	}
	(event.source as Window).postMessage(
		{
			type: 'relay',
			relayType: 'install-blueprint-result',
			...result,
		} satisfies InstallBlueprintResultMessage,
		event.origin
	);
}

function postPlaygroundWindowState(
	event: MessageEvent,
	result: Omit<PlaygroundWindowStateResultMessage, 'type' | 'relayType'>
) {
	if (!event.source) {
		return;
	}
	(event.source as Window).postMessage(
		{
			type: 'relay',
			relayType: 'playground-window-state',
			...result,
		} satisfies PlaygroundWindowStateResultMessage,
		event.origin
	);
}

function isMessageFromIframeTree(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): boolean {
	if (!iframe?.contentWindow || !event.source) {
		return false;
	}
	if (event.source === iframe.contentWindow) {
		return true;
	}
	return isDescendantWindow(iframe.contentWindow, event.source);
}

function isDescendantWindow(
	root: Window,
	candidate: MessageEventSource
): boolean {
	try {
		for (let i = 0; i < root.frames.length; i++) {
			const child = root.frames[i];
			if (child === candidate || isDescendantWindow(child, candidate)) {
				return true;
			}
		}
	} catch {
		// Cross-origin frames are not inspectable and therefore not accepted.
	}
	return false;
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

function getBlueprintRunnerClient<T extends object>(
	playground: T,
	blueprint: BlueprintV1Declaration
): T {
	if (shouldAllowBlueprintRunnerRedirect(blueprint)) {
		return playground;
	}
	return withoutGoTo(playground);
}

function shouldAllowBlueprintRunnerRedirect(
	blueprint: BlueprintV1Declaration
): boolean {
	return (
		!!blueprint.landingPage ||
		!!blueprint.login ||
		!!blueprint.steps?.some(isLoginStep)
	);
}

function isLoginStep(step: unknown): boolean {
	return (
		!!step &&
		typeof step === 'object' &&
		'step' in step &&
		(step as { step?: unknown }).step === 'login'
	);
}

function withoutGoTo<T extends object>(playground: T): T {
	return new Proxy(playground, {
		get(target, property, receiver) {
			if (property === 'goTo') {
				return async () => undefined;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
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
