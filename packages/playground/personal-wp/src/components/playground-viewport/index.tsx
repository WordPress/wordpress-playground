import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
	type BlueprintV1Declaration,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { ProgressTracker } from '@php-wasm/progress';
import { logger } from '@php-wasm/logger';

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
import {
	getMainTabUnavailableMessage,
	markMainTabReady,
	refreshMainTabStatus,
	requestRemoteBlueprintInstall,
	setInstallBlueprintRequestCallback,
} from '../../lib/state/redux/tab-coordinator';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { playgroundLogo } from '@wp-playground/components';
import { isAppBasePath } from '../../lib/state/url/app-base-url';
import Button from '../button';
import {
	getBlueprintInstallPreview,
	getBlueprintInstallSource,
	prepareBlueprintForRemoteInstall,
	resolveBlueprintForInstallExecution,
	shouldSkipBlueprintInstallConfirmation,
} from './blueprint-install';
import type { BlueprintInstallPreview } from './blueprint-install';
import { isAllowedBlueprintUrl } from '../../lib/blueprint-url';
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
	const mainTabStatus =
		clientInfo?.mainTabStatus ??
		(isDependentMode ? 'missing' : 'connected');
	const hasLocalRuntimeClient = !isDependentMode && !!playground;

	const [installingBlueprint, setInstallingBlueprint] = useState<
		string | null
	>(null);
	const [blueprintInstallDialogRequest, setBlueprintInstallDialogRequest] =
		useState<BlueprintInstallDialogRequest | null>(null);
	const installBannerResetTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const blueprintInstallDialogResolverRef = useRef<
		((confirmed: boolean) => void) | null
	>(null);

	const clearInstallBannerResetTimeout = useCallback(() => {
		if (installBannerResetTimeoutRef.current) {
			clearTimeout(installBannerResetTimeoutRef.current);
			installBannerResetTimeoutRef.current = null;
		}
	}, []);

	const scheduleInstallBannerReset = useCallback(() => {
		clearInstallBannerResetTimeout();
		installBannerResetTimeoutRef.current = setTimeout(() => {
			installBannerResetTimeoutRef.current = null;
			setInstallingBlueprint(null);
		}, 3000);
	}, [clearInstallBannerResetTimeout]);

	useEffect(() => {
		return clearInstallBannerResetTimeout;
	}, [clearInstallBannerResetTimeout]);

	const requestBlueprintInstallConfirmation = useCallback(
		(blueprintUrl: string): Promise<boolean> => {
			blueprintInstallDialogResolverRef.current?.(false);
			return new Promise((resolve) => {
				blueprintInstallDialogResolverRef.current = resolve;
				setBlueprintInstallDialogRequest({ blueprintUrl });
			});
		},
		[]
	);

	const closeBlueprintInstallDialog = useCallback((confirmed: boolean) => {
		const resolve = blueprintInstallDialogResolverRef.current;
		blueprintInstallDialogResolverRef.current = null;
		setBlueprintInstallDialogRequest(null);
		resolve?.(confirmed);
	}, []);

	useEffect(() => {
		return () => {
			blueprintInstallDialogResolverRef.current?.(false);
			blueprintInstallDialogResolverRef.current = null;
		};
	}, []);

	// Apply a blueprint in-place on the running instance.
	const applyBlueprint = useCallback(
		async (
			blueprintUrl: string,
			options: ApplyBlueprintOptions = {}
		): Promise<InstallBlueprintResult> => {
			if (!playground) {
				return {
					status: 'error',
					error: 'Playground is not ready.',
				};
			}
			const allowNavigation = options.allowNavigation ?? true;
			clearInstallBannerResetTimeout();
			try {
				setInstallingBlueprint('Installing\u2026');
				const { blueprint, declaration } =
					await resolveBlueprintForInstallExecution(
						blueprintUrl,
						corsProxyUrl
					);
				const title = declaration.meta?.title || 'app';
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
					getBlueprintRunnerClient(
						playground,
						declaration,
						allowNavigation
					)
				);
				if (allowNavigation && declaration.landingPage) {
					await playground.goTo(declaration.landingPage);
				}
			} catch (e) {
				logger.error('Failed to apply blueprint:', e);
				setInstallingBlueprint('Installation failed');
				scheduleInstallBannerReset();
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
			setInstallingBlueprint(null);
			return { status: 'success' };
		},
		[clearInstallBannerResetTimeout, playground, scheduleInstallBannerReset]
	);

	const applyBlueprintInMainTab = useCallback(
		async (blueprintUrl: string): Promise<InstallBlueprintResult> => {
			clearInstallBannerResetTimeout();
			try {
				setInstallingBlueprint('Installing in the active tab\u2026');
				const install = await prepareBlueprintForRemoteInstall(
					blueprintUrl,
					corsProxyUrl
				);
				const result = await requestRemoteBlueprintInstall(
					siteSlug,
					install.blueprintUrl
				);
				if (result.status === 'error') {
					setInstallingBlueprint('Installation failed');
					scheduleInstallBannerReset();
				} else {
					if (install.landingPage) {
						if (!playground) {
							setInstallingBlueprint('Installation failed');
							scheduleInstallBannerReset();
							return {
								status: 'error',
								error: 'The app was installed, but this tab could not open it.',
							};
						}
						setInstallingBlueprint('Opening app\u2026');
						await playground.goTo(install.landingPage);
					}
					setInstallingBlueprint(null);
				}
				return result;
			} catch (e) {
				setInstallingBlueprint('Installation failed');
				scheduleInstallBannerReset();
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
		},
		[
			clearInstallBannerResetTimeout,
			playground,
			scheduleInstallBannerReset,
			siteSlug,
		]
	);

	useEffect(() => {
		if (!hasLocalRuntimeClient) {
			return;
		}
		setInstallBlueprintRequestCallback((blueprintUrl) =>
			applyBlueprint(blueprintUrl, {
				allowNavigation: false,
			})
		);
		void markMainTabReady();
		return () => {
			setInstallBlueprintRequestCallback(null);
		};
	}, [applyBlueprint, hasLocalRuntimeClient]);

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
	}, [
		applyBlueprint,
		applyBlueprintInMainTab,
		hasLocalRuntimeClient,
		isDependentMode,
		requestBlueprintInstallConfirmation,
		siteSlug,
		url,
	]);

	async function installBlueprintFromRelay(
		event: MessageEvent,
		message: InstallBlueprintMessageData
	) {
		const { blueprintUrl, requestId } = message;
		let installLocally = hasLocalRuntimeClient;
		if (!installLocally) {
			if (!isDependentMode) {
				postInstallBlueprintResult(event, {
					blueprintUrl,
					requestId,
					status: 'error',
					error: 'Playground is not ready.',
				});
				return;
			}

			const status = await refreshMainTabStatus();
			if (status !== 'connected') {
				postInstallBlueprintResult(event, {
					blueprintUrl,
					requestId,
					status: 'error',
					error: getMainTabUnavailableMessage(status),
				});
				return;
			}
			installLocally = false;
		}

		const skipConfirmation = shouldSkipConfirmationForInstallMessage(
			event,
			iframeRef.current,
			url
		);
		if (
			!skipConfirmation &&
			!(await requestBlueprintInstallConfirmation(blueprintUrl))
		) {
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
			...(installLocally
				? await applyBlueprint(blueprintUrl)
				: await applyBlueprintInMainTab(blueprintUrl)),
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
			{blueprintInstallDialogRequest && (
				<BlueprintInstallDialog
					blueprintUrl={blueprintInstallDialogRequest.blueprintUrl}
					onClose={closeBlueprintInstallDialog}
				/>
			)}
			<JustViewport siteSlug={siteSlug} iframeRef={iframeRef} />
			<MainTabRecoveryNotice
				isDependentMode={isDependentMode}
				mainTabStatus={mainTabStatus}
			/>

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

function BlueprintInstallDialog({
	blueprintUrl,
	onClose,
}: {
	blueprintUrl: string;
	onClose: (confirmed: boolean) => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const dialogResolvedRef = useRef(false);
	const source = getBlueprintInstallSource(blueprintUrl);
	const [previewState, setPreviewState] =
		useState<BlueprintInstallPreviewState>({
			status: 'loading',
		});

	const closeDialog = useCallback(
		(confirmed: boolean) => {
			if (dialogResolvedRef.current) {
				return;
			}
			dialogResolvedRef.current = true;
			onClose(confirmed);
		},
		[onClose]
	);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || dialog.open) {
			return;
		}
		dialog.showModal();
		return () => {
			if (dialog.open) {
				dialog.close();
			}
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		setPreviewState({ status: 'loading' });
		getBlueprintInstallPreview(blueprintUrl, corsProxyUrl)
			.then((preview) => {
				if (!cancelled) {
					setPreviewState({ status: 'ready', preview });
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setPreviewState({
						status: 'error',
						error: getErrorMessage(error),
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [blueprintUrl]);

	const preview =
		previewState.status === 'ready' ? previewState.preview : null;
	const canInstall = previewState.status === 'ready';
	const blueprintTitle = preview
		? preview.title
		: previewState.status === 'error'
			? 'Preview unavailable'
			: 'Loading app details...';
	const warnings = preview?.warnings || [];
	const visibleWarnings = warnings.slice(0, 3);
	const hasDangerWarning = warnings.some(
		(warning) => warning.severity === 'danger'
	);
	const hasWarning = warnings.some(
		(warning) => warning.severity === 'warning'
	);

	return (
		<dialog
			ref={dialogRef}
			className={css.blueprintInstallDialog}
			aria-labelledby="blueprint-install-dialog-title"
			aria-describedby="blueprint-install-dialog-description"
			onCancel={(event) => {
				event.preventDefault();
				closeDialog(false);
			}}
			onClose={() => {
				closeDialog(false);
			}}
		>
			<div className={css.blueprintInstallDialogContent}>
				<div className={css.blueprintInstallDialogHeader}>
					<h2 id="blueprint-install-dialog-title">Install app?</h2>
					<p id="blueprint-install-dialog-description">
						A WordPress page requested to install an app from{' '}
						<strong>{source.label}</strong>. This may change your
						site.
					</p>
				</div>

				<div className={css.blueprintInstallSummary}>
					<h3>
						{blueprintTitle}
						{preview?.author && <span> by {preview.author}</span>}
					</h3>
					{preview && (
						<p>
							{preview.description ?? 'No description provided.'}
						</p>
					)}
				</div>

				{warnings.length > 0 && (
					<div
						className={classNames(css.blueprintInstallWarnings, {
							[css.blueprintInstallWarningsDanger]:
								hasDangerWarning,
							[css.blueprintInstallWarningsWarning]:
								!hasDangerWarning && hasWarning,
						})}
					>
						<strong>
							{hasDangerWarning
								? 'Review high-risk actions'
								: hasWarning
									? 'Review app actions'
									: 'App actions'}
						</strong>
						<ul>
							{visibleWarnings.map((warning, index) => (
								<li key={index}>
									<span>{warning.title}</span>
									<p>{warning.description}</p>
								</li>
							))}
						</ul>
						{warnings.length > visibleWarnings.length && (
							<p>
								Open the details below to review the full
								configuration.
							</p>
						)}
					</div>
				)}

				{previewState.status === 'loading' && (
					<div className={css.blueprintInstallStatus}>
						Loading app details...
					</div>
				)}
				{previewState.status === 'error' && (
					<div className={css.blueprintInstallError} role="alert">
						Could not load app details: {previewState.error}
					</div>
				)}
				{preview && (
					<details className={css.blueprintInstallDetails}>
						<summary>View blueprint.json</summary>
						<pre tabIndex={0}>
							<code>{preview.json}</code>
						</pre>
					</details>
				)}

				<div className={css.blueprintInstallDialogActions}>
					<button type="button" onClick={() => closeDialog(false)}>
						Cancel
					</button>
					<button
						type="button"
						disabled={!canInstall}
						onClick={() => closeDialog(true)}
					>
						Install
					</button>
				</div>
			</div>
		</dialog>
	);
}

function MainTabRecoveryNotice({
	isDependentMode,
	mainTabStatus,
}: {
	isDependentMode: boolean;
	mainTabStatus: 'connected' | 'booting' | 'missing';
}) {
	if (!isDependentMode || mainTabStatus === 'connected') {
		return null;
	}

	const isMissing = mainTabStatus === 'missing';

	return (
		<div className={css.mainTabNotice} role="status" aria-live="polite">
			<div className={css.mainTabNoticeText}>
				<strong>
					{isMissing
						? 'The active WordPress tab was disconnected.'
						: 'The active WordPress tab is reconnecting.'}
				</strong>
				<span>
					{isMissing
						? ' This page is preserved, but WordPress cannot handle new requests until a tab reconnects.'
						: ' This page is preserved while WordPress starts again.'}
				</span>
			</div>
			{isMissing && (
				<div className={css.mainTabNoticeActions}>
					<button
						type="button"
						onClick={() => window.location.reload()}
					>
						Reload this tab
					</button>
					<button
						type="button"
						onClick={() =>
							window.open(
								window.location.href,
								'_blank',
								'noopener,noreferrer'
							)
						}
					>
						Open new tab
					</button>
				</div>
			)}
		</div>
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

type BlueprintInstallDialogRequest = {
	blueprintUrl: string;
};

type BlueprintInstallPreviewState =
	| {
			status: 'loading';
	  }
	| {
			status: 'ready';
			preview: BlueprintInstallPreview;
	  }
	| {
			status: 'error';
			error: string;
	  };

type ApplyBlueprintOptions = {
	allowNavigation?: boolean;
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
		typeof data.blueprintUrl !== 'string' ||
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

function getRequestId(data: RelayMessageData): string | undefined {
	return typeof data.requestId === 'string' ? data.requestId : undefined;
}

function shouldSkipConfirmationForInstallMessage(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null,
	currentUrl: string | undefined
): boolean {
	return [
		getWindowLocation(event.source),
		getWindowLocation(iframe?.contentWindow),
		currentUrl,
	].some(shouldSkipBlueprintInstallConfirmation);
}

function getWindowLocation(
	source: MessageEventSource | Window | null | undefined
): string | undefined {
	if (!source || !('location' in source)) {
		return;
	}

	try {
		return (source as Window).location.href;
	} catch {
		return;
	}
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

function getBlueprintRunnerClient<T extends object>(
	playground: T,
	blueprint: BlueprintV1Declaration,
	allowNavigation: boolean
): T {
	if (allowNavigation && shouldAllowBlueprintRunnerRedirect(blueprint)) {
		return playground;
	}
	return withoutGoTo(playground);
}

function shouldAllowBlueprintRunnerRedirect(
	blueprint: BlueprintV1Declaration
): boolean {
	return !!blueprint.landingPage;
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
