import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	Button,
	DropdownMenu,
	MenuItem,
	Notice,
	TextControl,
	TextareaControl,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { Icon, check, moreVertical } from '@wordpress/icons';
import { formatBytes } from '@php-wasm/util';
import { usePrevious } from '../../../lib/hooks/use-previous';
import {
	generateReprintKeyPair,
	type ReprintKeyPair,
} from '../../../lib/reprint/keys';
import { readReprintConnection } from '../../../lib/reprint/connection';
import {
	setDockOperationNotice,
	setDockPaneOpen,
	setDockPaneSection,
	setCloneRequested,
	setPendingClone,
} from '../../../lib/state/redux/slice-ui';
import {
	selectAllSites,
	updateSiteMetadata,
} from '../../../lib/state/redux/slice-sites';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';
import { getUniqueSiteSlug } from '../../../lib/state/redux/site-slug';
import { getPlaygroundDefinedPHPConstants } from '../../../lib/state/redux/playground-defined-php-constants';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import type { SiteToolPanelProps } from '../site-info-panel/site-tool-renderers';
import { InlineProgress, PlaygroundBootNotice } from '../../pane-loading';
import css from './style.module.css';
import { TransferProgressView } from './transfer-progress';
import { getTransferDiagnostics } from '../../../lib/reprint/transfer-diagnostics';
import {
	detectReprint,
	getReprintAdminUrls,
	pullSite,
	loginImportedSite,
	type ReprintAvailability,
	type TransferProgress,
} from '../../../lib/reprint/reprint';
import {
	ReprintTransferError,
	getTransferRecovery,
} from '../../../lib/reprint/transfer-error';

/** Connect a live site and hand its clone to a new temporary Playground. */
export function SiteTransferPanel({
	site,
	playground,
	isVisible,
	onBackChange,
	onCloseBlockedChange,
}: SiteToolPanelProps) {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	// Clone mode collects a live site before any Playground exists for it. The
	// current site only hosts the form; the pull runs in a new Playground.
	const cloneRequested = !!useAppSelector((state) => state.ui.cloneRequested);
	const pendingClone = useAppSelector((state) => state.ui.pendingClone);
	const existingSlugs = useAppSelector(selectAllSites).map(
		(existing) => existing.slug
	);
	const handoff = pendingClone?.slug === site.slug ? pendingClone : null;
	// The store drops the clone request when the new site activates, but this
	// panel, mounted for that site with a handoff, is still cloning.
	const [isClone, setIsClone] = useState(!!handoff);
	const cloning = cloneRequested || isClone;
	const [url, setUrl] = useState(() =>
		cloneRequested
			? ''
			: (handoff?.url ?? rememberedConnection(site.slug)?.url ?? '')
	);
	const [keyPair, setKeyPair] = useState<ReprintKeyPair | null>(() =>
		cloneRequested
			? null
			: (handoff?.keyPair ??
				rememberedConnection(site.slug)?.keyPair ??
				null)
	);
	const [step, setStep] = useState<
		| 'site'
		| 'install'
		| 'key'
		| 'copying-key'
		| 'manual-key'
		| 'authorize'
		| 'confirm'
		| 'transfer'
	>(handoff ? 'transfer' : 'site');
	// A clone handoff pulls as soon as the new Playground can run PHP.
	const [autoStart, setAutoStart] = useState(!!handoff);
	const heading = useRef<HTMLHeadingElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const [setup, setSetup] = useState<
		ReprintAvailability | 'checking' | 'manual' | null
	>(handoff ? 'manual' : null);
	const checkController = useRef<AbortController>();
	const skipConnectionRestore = useRef(false);
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const [progress, setProgress] = useState<TransferProgress>({ message: '' });
	const [error, setError] = useState<string | ReprintTransferError>('');
	const [completed, setCompleted] = useState(false);
	const [warning, setWarning] = useState('');
	const [diagnostics, setDiagnostics] = useState('');
	const stopController = useRef<AbortController>();
	const [summary, setSummary] = useState<{
		files: number;
		bytes: number;
		seconds: number;
	}>();
	const [stopping, setStopping] = useState(false);
	const [confirmStop, setConfirmStop] = useState(false);
	const [readingDiagnostics, setReadingDiagnostics] = useState(false);
	const links = setup ? getReprintAdminUrls(url) : null;
	const hostname = links ? new URL(links.site).hostname : '';
	const recovery =
		step === 'transfer' && error instanceof ReprintTransferError
			? getTransferRecovery(error.details)
			: null;
	const recoveryUrl =
		recovery && links
			? {
					settings: links.settings,
					install: links.install,
					plugins: links.plugins,
					admin: links.admin,
					wordfence: links.wordfence,
					site: links.site,
					cli: 'https://github.com/WordPress/reprint#readme',
					address: undefined,
					resume: undefined,
					'open-copy': undefined,
				}[recovery.action]
			: undefined;
	const acceptsKey =
		setup === 'configured' || setup === 'needs-key' || setup === 'manual';
	const keyReady = acceptsKey && !!keyPair;
	const generatingKey = step === 'key' && !keyPair && !error;
	const ready =
		playground &&
		site.metadata.runtimeConfiguration.networking &&
		Number.parseFloat(site.metadata.runtimeConfiguration.phpVersion) >= 8.1;
	const isKeySetup =
		step !== 'site' && step !== 'install' && step !== 'transfer';
	const wasKeySetupVisible = usePrevious(
		isKeySetup && isVisible && !busy && !completed
	);
	const keyCopied = step === 'authorize' || step === 'confirm';

	// Restore only an idle address form. A late saved-connection read must not
	// replace transfer progress or a completed clone. Explicit address editing
	// takes priority until the panel closes.
	useEffect(() => {
		if (!isVisible) {
			skipConnectionRestore.current = false;
			return;
		}
		if (
			cloneRequested ||
			!playground ||
			running.current ||
			step !== 'site' ||
			skipConnectionRestore.current
		)
			return;
		let cancelled = false;
		void readReprintConnection(playground)
			.then((connection) => {
				if (cancelled || !connection || skipConnectionRestore.current)
					return;
				const address = getReprintAdminUrls(connection).site;
				const saved = rememberedConnection(site.slug);
				setUrl(address);
				setKeyPair(saved?.url === address ? saved.keyPair : null);
				setSetup('manual');
				setCompleted(false);
				setError('');
				setStep('key');
			})
			.catch(() => {
				// Invalid saved URLs must not block entering a new address.
			});
		return () => {
			cancelled = true;
		};
	}, [isVisible, playground, site.slug, cloneRequested, step]);

	// Generate once per live-site address. A late key generation must not attach
	// the old address's pair to a different site or a closed setup step.
	useEffect(() => {
		if (step !== 'key' || keyPair) return;
		let cancelled = false;
		void generateReprintKeyPair().then(
			(pair) => {
				if (cancelled) return;
				setKeyPair(pair);
				// Enrollment may happen before the user returns to press Clone.
				// Closing and reopening the panel must keep that same pair.
				rememberConnection(
					site.slug,
					getReprintAdminUrls(url).site,
					pair
				);
			},
			(error) => {
				if (cancelled) return;
				setError(
					`Could not generate a migration key: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		);
		return () => {
			cancelled = true;
		};
	}, [step, url, keyPair, site.slug]);

	useEffect(() => () => checkController.current?.abort(), []);

	// The handoff is read once, when this panel mounts for the new Playground.
	// Forget it so later visits to the pane start from the saved connection.
	useEffect(() => {
		if (handoff) dispatch(setPendingClone(undefined));
	}, [handoff, dispatch]);

	useEffect(() => {
		if (!isVisible) return;
		if (completed || error) {
			heading.current?.focus();
			return;
		}
		// Copying and opening settings update the same checklist. Keep the clicked
		// control focused instead of sending keyboard users back to its heading.
		if (isKeySetup && wasKeySetupVisible && step !== 'manual-key') return;
		const input = Array.from(
			content.current?.querySelectorAll<
				HTMLInputElement | HTMLTextAreaElement
			>(
				'input:not([disabled]):not([type=checkbox]), textarea[readonly]'
			) ?? []
		).find((input) => !input.closest('details:not([open])'));
		if (input) input.focus();
		else heading.current?.focus();
	}, [
		step,
		isVisible,
		busy,
		completed,
		keyPair,
		setup,
		error,
		isKeySetup,
		wasKeySetupVisible,
	]);

	useEffect(() => {
		if (!busy) return;
		/** Warn before a reload discards the unfinished in-memory clone. */
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [busy]);

	/** Drop the previous probe and key when selecting another live site. */
	const changeUrl = (value: string) => {
		skipConnectionRestore.current = true;
		checkController.current?.abort();
		setUrl(value);
		setSetup(null);
		setStep('site');
		setKeyPair(null);
		setError('');
		setCompleted(false);
	};

	/** Copy during the click gesture; ignore completion after Back or an address edit. */
	const copyMigrationKey = async () => {
		if (!keyPair || step === 'copying-key') return;
		checkController.current?.abort();
		const controller = new AbortController();
		checkController.current = controller;
		// Copying again must not undo a settings tab the user already opened.
		if (!keyCopied) setStep('copying-key');
		try {
			await navigator.clipboard.writeText(keyPair.publicKey);
			if (!controller.signal.aborted)
				setStep(step === 'confirm' ? 'confirm' : 'authorize');
		} catch {
			if (!controller.signal.aborted) setStep('manual-key');
		}
	};

	/** Advance only when the current address probe returns. */
	const checkSite = async () => {
		checkController.current?.abort();
		const controller = new AbortController();
		checkController.current = controller;
		setError('');
		try {
			const address = getReprintAdminUrls(url).site;
			setUrl(address);
			setSetup('checking');
			const result = await detectReprint(address, controller.signal);
			if (!controller.signal.aborted) {
				setSetup(result);
				const saved = rememberedConnection(site.slug);
				const savedKey =
					!keyPair && saved?.url === address ? saved.keyPair : null;
				if (savedKey) {
					setKeyPair(savedKey);
				}
				setStep(
					result === 'configured' || result === 'needs-key'
						? 'key'
						: 'install'
				);
			}
		} catch (error) {
			if (!controller.signal.aborted) {
				setSetup(null);
				setStep('site');
				setError(
					error instanceof Error ? error.message : String(error)
				);
			}
		}
	};

	/** Return to the previous setup input without forgetting a valid key. */
	const goBack = useCallback(() => {
		checkController.current?.abort();
		setAutoStart(false);
		setError('');
		if (step === 'site') {
			dispatch(setCloneRequested(false));
			dispatch(setDockPaneSection('new'));
			return;
		}
		if (step === 'transfer') {
			setStep('key');
		} else {
			skipConnectionRestore.current = true;
			setSetup(null);
			setStep('site');
		}
	}, [dispatch, step]);

	/** Run the pull, retain failures for retry, then autosave the completed clone. */
	const start = useCallback(async () => {
		if (!playground || !ready || !keyReady || running.current) return;
		running.current = true;
		setStep('transfer');
		setBusy(true);
		setError('');
		setCompleted(false);
		setWarning('');
		setDiagnostics('');
		setProgress({
			message: 'Starting Reprint…',
			overallPercent: 0,
		});
		const controller = new AbortController();
		stopController.current = controller;
		setStopping(false);
		setConfirmStop(false);
		const startedAt = Date.now();
		const totals = { files: 0, bytes: 0 };
		try {
			const result = await pullSite(
				playground,
				url,
				keyPair!.privateKey,
				(update) => {
					// File batches report both counters; keep the last totals
					// for the completion summary.
					if (update.filesTotal !== undefined) {
						totals.files = update.filesTotal;
						totals.bytes = update.bytesTotal ?? totals.bytes;
					}
					setProgress(update);
				},
				controller.signal
			);
			setSummary({ ...totals, seconds: (Date.now() - startedAt) / 1000 });
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: {
						playgroundDefinedConstants:
							await getPlaygroundDefinedPHPConstants(playground),
					},
				})
			);
			setWarning(result?.warning ?? '');
			setCompleted(!result?.loginError);
			setError(result?.loginError ?? '');
			setSetup('configured');
			// The copy is installed even if sign-in failed. Persist it in the
			// background; the address bar’s save indicator reports it.
			void sitesAPI
				.autosaveTemporarySite(site.slug, { updateUrl: true })
				.catch((error) => {
					dispatch(
						setDockOperationNotice({
							status: 'error',
							title: 'Couldn’t save the cloned site',
							message:
								error instanceof Error
									? error.message
									: String(error),
						})
					);
				});
		} catch (error) {
			setSetup('manual');
			if ((error as { name?: string } | null)?.name === 'AbortError') {
				// Stopped on request: the confirmation step offers to resume later.
				setStep('confirm');
				return;
			}
			const message =
				error instanceof Error ? error.message : String(error);
			// An unenrolled key can be added on the live site before retrying.
			// Keep this pair; replacing it would require another enrollment.
			setStep('transfer');
			setError(
				error instanceof ReprintTransferError
					? error
					: new ReprintTransferError(message)
			);
		} finally {
			running.current = false;
			setBusy(false);
		}
	}, [
		dispatch,
		playground,
		ready,
		keyReady,
		site.slug,
		url,
		keyPair,
		sitesAPI,
	]);

	/** Retry only sign-in after a completed copy, without touching transfer checkpoints. */
	const retryLogin = async () => {
		if (!playground || running.current) return;
		running.current = true;
		setBusy(true);
		setError('');
		setProgress({
			phase: 'login',
			message: 'Signing in to the cloned site…',
		});
		try {
			setWarning((await loginImportedSite(playground)) ?? '');
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: {
						playgroundDefinedConstants:
							await getPlaygroundDefinedPHPConstants(playground),
					},
				})
			);
			setCompleted(true);
		} catch (error) {
			setError(
				new ReprintTransferError(
					error instanceof Error ? error.message : String(error),
					{ code: 'LOGIN_FAILED', stage: 'login' }
				)
			);
		} finally {
			running.current = false;
			setBusy(false);
		}
	};

	// A pull rewrites the site underneath the Playground, and switching sites
	// would end its PHP runtime. Pin the pane until it completes or is stopped.
	useEffect(() => {
		onCloseBlockedChange?.(busy || autoStart);
		return () => onCloseBlockedChange?.(false);
	}, [busy, autoStart, onCloseBlockedChange]);

	// The panel that created the clone can be kept for the new site instead of
	// remounting; a handoff arriving after mount must still start the pull.
	useEffect(() => {
		if (handoff) {
			setIsClone(true);
			setStep('transfer');
			setAutoStart(true);
		}
	}, [handoff]);

	useEffect(() => {
		if (!isVisible || !autoStart || !ready || !keyReady) return;
		setAutoStart(false);
		dispatch(setPendingClone(undefined));
		void start();
	}, [isVisible, autoStart, ready, keyReady, start, dispatch]);

	// An idle transfer step has nothing to show and would keep the dock
	// locked. Only a running, finished, or failed pull belongs there.
	useEffect(() => {
		if (
			step === 'transfer' &&
			!busy &&
			!completed &&
			!error &&
			!autoStart &&
			!handoff
		) {
			setStep('key');
		}
	}, [step, busy, completed, error, autoStart, handoff]);

	/**
	 * Creates the Playground that receives the clone. Its transfer panel mounts
	 * with the connection details and starts the pull once the site has booted.
	 */
	const cloneIntoNewSite = async () => {
		if (!keyReady || running.current) return;
		running.current = true;
		setStep('transfer');
		setBusy(true);
		setError('');
		setProgress({
			message: 'Creating a new Playground…',
			overallPercent: 0,
		});
		const address = getReprintAdminUrls(url).site;
		const slug = getUniqueSiteSlug(undefined, {
			unavailableSlugs: existingSlugs,
		});
		rememberConnection(slug, address, keyPair!);
		dispatch(setPendingClone({ slug, url: address, keyPair: keyPair! }));
		try {
			// The clone stays temporary while it downloads: nothing is written to
			// browser storage until the site is complete and usable.
			// Keep the browser URL as it is: a temporary site's URL carries its
			// setup parameters, and routing to it would start yet another site.
			const created = await sitesAPI.createNewTemporarySite(
				slug,
				{ networking: true, phpVersion: '8.3' },
				{ updateUrl: false }
			);
			if (created !== slug) {
				rememberConnection(created, address, keyPair!);
				dispatch(
					setPendingClone({
						slug: created,
						url: address,
						keyPair: keyPair!,
					})
				);
			}
		} catch (error) {
			dispatch(setPendingClone(undefined));
			setSetup('manual');
			setStep('key');
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			running.current = false;
			setBusy(false);
		}
	};

	/** Copy redacted diagnostics or show a selectable fallback. */
	const copyTransferLog = useCallback(async () => {
		if (!playground || readingDiagnostics) return;
		setReadingDiagnostics(true);
		setDiagnostics('');
		try {
			const report = await getTransferDiagnostics(playground);
			try {
				await navigator.clipboard.writeText(report);
				dispatch(
					setDockOperationNotice({
						status: 'success',
						title: 'Transfer log copied',
					})
				);
			} catch {
				// The report remains selectable when clipboard access is unavailable.
				setDiagnostics(report);
			}
		} catch (error) {
			setDiagnostics(
				`Could not read the transfer log: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			setReadingDiagnostics(false);
		}
	}, [playground, readingDiagnostics, dispatch]);

	// The transfer log is a support tool, so it hides behind an overflow menu
	// rather than sitting beside the primary actions. Memoized: the header
	// effect below reports it upward, and a fresh element every render would
	// loop that update.
	const transferLogMenu = useMemo(
		() =>
			playground &&
			!cloneRequested && (
				<DropdownMenu
					icon={moreVertical}
					label="More options"
					className={css.overflowMenu}
					popoverProps={{ placement: 'bottom-end' }}
				>
					{({ onClose }) => (
						<MenuItem
							disabled={readingDiagnostics}
							onClick={() => {
								onClose();
								void copyTransferLog();
							}}
						>
							Copy transfer log
						</MenuItem>
					)}
				</DropdownMenu>
			),
		[playground, cloneRequested, readingDiagnostics, copyTransferLog]
	);

	useLayoutEffect(() => {
		if (!isVisible) return;
		onBackChange?.(
			busy
				? {
						title:
							progress.phase === 'login'
								? `Signing in to ${hostname}`
								: `${cloning ? 'Cloning' : 'Pulling'} ${hostname}`,
						action: transferLogMenu,
					}
				: completed
					? // The result screen names the site itself and needs no header.
						{ title: 'Site cloned', hideHeader: true }
					: recovery?.action === 'open-copy'
						? { title: 'Site cloned', action: transferLogMenu }
						: step !== 'site' || cloning
							? {
									action:
										step === 'transfer'
											? transferLogMenu
											: undefined,
									backLabel:
										step === 'site'
											? 'Back to New Playground'
											: step === 'transfer'
												? 'Back to migration key'
												: 'Back to site address',
									onBack: goBack,
								}
							: undefined
		);
		return () => onBackChange?.(undefined);
	}, [
		isVisible,
		busy,
		completed,
		step,
		cloning,
		hostname,
		goBack,
		onBackChange,
		transferLogMenu,
		recovery?.action,
		progress.phase,
	]);

	/** Follow the recovery step without replacing the current clone or key. */
	const recoverTransfer = () => {
		if (recovery?.action === 'address') {
			skipConnectionRestore.current = true;
			setError('');
			setSetup(null);
			setStep('site');
		} else if (recovery?.action === 'open-copy') {
			void playground?.goTo('/');
			dispatch(setDockPaneOpen(false));
		} else {
			void start();
		}
	};

	const migrationKeyField = (
		<TextareaControl
			__nextHasNoMarginBottom
			label="Migration key"
			onChange={() => {}}
			readOnly
			autoFocus={isVisible && step === 'manual-key'}
			onFocus={(event) => event.target.select()}
			value={keyPair?.publicKey ?? ''}
			rows={3}
		/>
	);

	return (
		<VStack spacing={4} className={css.panel}>
			<div
				ref={content}
				key={`${isKeySetup ? 'connection' : step}-${busy}-${completed}`}
				className={css.stepContent}
			>
				{error && (
					<VStack spacing={5} className={css.error} role="alert">
						<VStack spacing={2}>
							<h3
								ref={heading}
								tabIndex={-1}
								className={css.setupTitle}
							>
								{recovery?.title ??
									'Couldn’t complete this step'}
							</h3>
							<p className={css.hint}>
								{recovery?.message ??
									(error instanceof Error
										? error.message
										: error)}
							</p>
							{recovery?.action === 'settings' && (
								<Button variant="link" onClick={goBack}>
									View migration key
								</Button>
							)}
						</VStack>
						{!busy && recovery && keyReady && (
							<div className={css.actions}>
								<Button
									variant="primary"
									href={recoveryUrl}
									target={recoveryUrl ? '_blank' : undefined}
									rel={recoveryUrl ? 'noreferrer' : undefined}
									onClick={
										recoveryUrl
											? undefined
											: recoverTransfer
									}
								>
									{recovery.label}
								</Button>
								{recovery.resumeLabel && (
									<Button
										variant="secondary"
										onClick={() => {
											if (recovery.action === 'open-copy')
												void retryLogin();
											else void start();
										}}
									>
										{recovery.resumeLabel}
									</Button>
								)}
							</div>
						)}
						{recovery && error instanceof ReprintTransferError && (
							<details className={css.errorDetails}>
								<summary>Technical details</summary>
								<pre>
									{[
										error.details.code,
										error.details.stage &&
											`Stage: ${error.details.stage}`,
										error.details.httpStatus &&
											`HTTP ${error.details.httpStatus}`,
										error.details.curlError &&
											`cURL ${error.details.curlError}`,
										error.message,
									]
										.filter(Boolean)
										.join('\n')}
								</pre>
							</details>
						)}
					</VStack>
				)}
				{!busy && !completed && autoStart && !error && (
					<InlineProgress message="Waiting for the new Playground to boot…" />
				)}
				{!busy && !completed && step === 'site' && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void checkSite();
						}}
					>
						<VStack spacing={4}>
							{cloneRequested && (
								<p className={css.intro}>
									Copy a live site into a new Playground with
									Reprint. Your live site stays unchanged.
								</p>
							)}
							<VStack spacing={2}>
								<div className={css.siteForm}>
									<TextControl
										__nextHasNoMarginBottom
										hideLabelFromVision
										className={css.heroInput}
										autoFocus={isVisible}
										label="Live site URL"
										type="url"
										value={url}
										onChange={changeUrl}
										disabled={busy}
										placeholder="https://example.com"
									/>
									<Button
										type="submit"
										variant={
											setup && setup !== 'checking'
												? 'secondary'
												: 'primary'
										}
										isBusy={setup === 'checking'}
										disabled={
											busy || !url || setup === 'checking'
										}
									>
										{setup === 'checking'
											? 'Checking…'
											: setup
												? 'Check again'
												: 'Check site'}
									</Button>
								</div>
								<p className={css.hint}>
									You’ll need admin access to this site.
								</p>
							</VStack>
						</VStack>
					</form>
				)}
				{!busy && !completed && step === 'install' && links && (
					<VStack spacing={6}>
						<VStack spacing={2}>
							<h3
								ref={heading}
								tabIndex={-1}
								className={css.setupTitle}
							>
								Install Reprint Server
							</h3>
							<p className={css.hint}>
								{setup === 'unreachable'
									? 'We couldn’t check Reprint on '
									: 'Add the plugin to '}
								<a
									href={links.site}
									target="_blank"
									rel="noreferrer"
									className={css.setupSite}
								>
									{hostname}
								</a>
								{setup === 'unreachable'
									? '. Check the address, or follow the steps below.'
									: ' so Playground can connect to your live site.'}
							</p>
						</VStack>
						<VStack as="ol" spacing={6} className={css.steps}>
							<li>
								<a
									href={links.install}
									target="_blank"
									rel="noreferrer"
								>
									Install Reprint
								</a>
								<p className={css.hint}>
									Sign in if asked. Choose{' '}
									<strong>Install Now</strong>.
								</p>
							</li>
							<li>
								<strong>Activate the plugin</strong>
								<p className={css.hint}>
									Choose <strong>Activate</strong>, then come
									back here.
								</p>
							</li>
						</VStack>
						<VStack spacing={4}>
							<Button
								variant="primary"
								isBusy={setup === 'checking'}
								disabled={setup === 'checking'}
								onClick={() => void checkSite()}
							>
								{setup === 'checking'
									? 'Checking…'
									: 'Check again'}
							</Button>
							<div className={css.manualConnection}>
								<span>Already active?</span>
								<Button
									variant="link"
									disabled={setup === 'checking'}
									onClick={() => {
										setSetup('manual');
										setStep('key');
									}}
								>
									Connect manually
								</Button>
							</div>
						</VStack>
					</VStack>
				)}
				{!busy && !completed && isKeySetup && links && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (step !== 'confirm') return;
							if (cloneRequested) {
								void cloneIntoNewSite();
								return;
							}
							if (keyReady && ready) {
								rememberConnection(
									site.slug,
									getReprintAdminUrls(url).site,
									keyPair!
								);
								void start();
							}
						}}
					>
						<VStack spacing={4}>
							<ol
								className={css.connectionSteps}
								aria-label="Connection steps"
							>
								<li
									aria-current={
										!keyCopied ? 'step' : undefined
									}
								>
									<h3
										ref={error ? undefined : heading}
										tabIndex={-1}
										className={css.setupTitle}
									>
										1. Copy your migration key
									</h3>
									<p className={css.hint}>
										You’ll paste it into Reprint on your
										live site.
									</p>
									{generatingKey && (
										<InlineProgress message="Generating a migration key…" />
									)}
									{step === 'manual-key' && (
										<>
											<p
												className={css.hint}
												role="alert"
											>
												We couldn’t copy automatically.
												Select and copy the key below.
											</p>
											{migrationKeyField}
										</>
									)}
									<div className={css.actions}>
										<Button
											variant={
												keyCopied
													? 'secondary'
													: 'primary'
											}
											disabled={
												!keyReady ||
												step === 'copying-key'
											}
											accessibleWhenDisabled={
												step === 'copying-key'
											}
											isBusy={step === 'copying-key'}
											onClick={() => {
												if (step === 'manual-key')
													setStep('authorize');
												else void copyMigrationKey();
											}}
										>
											{step === 'manual-key'
												? 'I’ve copied the key'
												: 'Copy migration key'}
										</Button>
										<span
											className={css.keyCopied}
											role="status"
										>
											{keyCopied && (
												<>
													<Icon
														icon={check}
														size={16}
													/>
													Copied
												</>
											)}
										</span>
									</div>
								</li>
								<li
									aria-current={
										step === 'authorize'
											? 'step'
											: undefined
									}
								>
									<h3
										className={`${css.setupTitle} ${css.setupSite}`}
									>
										2. Authorize on {hostname}
									</h3>
									<p className={css.hint}>
										Paste into{' '}
										<strong>Migration Token</strong>, then
										choose <strong>Authorize tool</strong>.
									</p>
									{keyCopied ? (
										<Button
											variant={
												step === 'authorize'
													? 'primary'
													: 'secondary'
											}
											href={links.settings}
											target="_blank"
											rel="noreferrer"
											onClick={() => setStep('confirm')}
										>
											Open Reprint settings ↗
										</Button>
									) : (
										<Button variant="secondary" disabled>
											Open Reprint settings ↗
										</Button>
									)}
								</li>
								<li
									aria-current={
										step === 'confirm' ? 'step' : undefined
									}
								>
									<h3 className={css.setupTitle}>
										3. Return here and{' '}
										{cloning ? 'clone' : 'pull'} your site
									</h3>
									<p className={css.hint}>
										We’ll check access before copying your
										site.
									</p>
									<Button
										type="submit"
										variant={
											step === 'confirm'
												? 'primary'
												: 'secondary'
										}
										disabled={
											step !== 'confirm' ||
											!keyReady ||
											(!cloneRequested && !ready)
										}
									>
										{cloning
											? 'I’ve authorized it — clone site'
											: 'I’ve authorized it — pull site'}
									</Button>
								</li>
							</ol>
							{keyPair && (
								<details className={css.connectionDetails}>
									<summary>
										{step === 'manual-key'
											? 'About this connection'
											: 'Show key and connection details'}
									</summary>
									{step !== 'manual-key' && migrationKeyField}
									<p className={css.hint}>
										Only the migration key goes to your live
										site. The private key stays in this tab
										and is reused when you retry.
									</p>
								</details>
							)}
							{!cloneRequested && (
								<PlaygroundBootNotice show={!playground} />
							)}
							{!cloneRequested && !ready && playground && (
								<Notice status="info" isDismissible={false}>
									Enable networking and use PHP 8.1 or newer.
								</Notice>
							)}
						</VStack>
					</form>
				)}
				{busy && <TransferProgressView progress={progress} />}
				{busy && confirmStop && (
					<Notice status="warning" isDismissible={false}>
						<p>
							Stop pulling {hostname}? Downloaded files stay
							saved, so you can resume later.
						</p>
						<div className={css.actions}>
							<Button
								variant="primary"
								isDestructive
								onClick={() => {
									stopController.current?.abort();
									setStopping(true);
									setConfirmStop(false);
								}}
							>
								Stop pulling
							</Button>
							<Button
								variant="tertiary"
								onClick={() => setConfirmStop(false)}
							>
								Keep pulling
							</Button>
						</div>
					</Notice>
				)}
				{busy && !confirmStop && progress.phase !== 'login' && (
					<div className={css.transferFooter}>
						<p className={css.hint}>
							{cloning
								? 'Keep this tab open until the clone finishes.'
								: 'Local edits may be replaced. Keep this tab open until the pull finishes.'}
						</p>
						<Button
							variant="secondary"
							className={css.stopButton}
							disabled={stopping}
							onClick={() => setConfirmStop(true)}
						>
							{stopping ? 'Stopping after this step…' : 'Stop'}
						</Button>
					</div>
				)}
				{diagnostics && (
					<TextareaControl
						label="Transfer log"
						help="Copying to the clipboard failed. Select the log and copy it manually."
						readOnly
						value={diagnostics}
						onChange={setDiagnostics}
						rows={8}
						__nextHasNoMarginBottom
					/>
				)}
				{completed && (
					<div className={css.done}>
						<span className={css.doneIcon}>
							<Icon icon={check} size={32} />
						</span>
						<h3
							ref={heading}
							tabIndex={-1}
							className={css.doneTitle}
						>
							{hostname} cloned
						</h3>
						{summary && (
							<p className={css.doneSummary}>
								{[
									summary.files
										? `${summary.files.toLocaleString()} files`
										: '',
									summary.bytes
										? formatBytes(summary.bytes)
										: '',
									formatDuration(summary.seconds),
								]
									.filter(Boolean)
									.join(' · ')}
							</p>
						)}
					</div>
				)}
				{warning && (
					<Notice status="warning" isDismissible={false}>
						{warning}
					</Notice>
				)}
				{completed && (
					<div className={css.doneActions}>
						<Button
							variant="primary"
							onClick={() => dispatch(setDockPaneOpen(false))}
						>
							Open site
						</Button>
					</div>
				)}
				{completed && (
					<p className={css.doneNote}>
						You’re signed in as an administrator. Your live site was
						not changed.
					</p>
				)}
			</div>
		</VStack>
	);
}

/** "4 min 12 s" for the completion summary; seconds only under a minute. */
function formatDuration(seconds: number): string {
	const whole = Math.max(1, Math.round(seconds));
	const minutes = Math.floor(whole / 60);
	return minutes ? `${minutes} min ${whole % 60} s` : `${whole} s`;
}

/** Read a tab-scoped key only alongside its normalized live-site address. */
function rememberedConnection(
	slug: string
): { url: string; keyPair: ReprintKeyPair } | null {
	try {
		const saved = JSON.parse(
			sessionStorage.getItem(`playground-reprint:${slug}`) ?? 'null'
		);
		if (
			typeof saved?.url === 'string' &&
			typeof saved?.keyPair?.privateKey === 'string' &&
			typeof saved?.keyPair?.publicKey === 'string'
		) {
			return {
				url: getReprintAdminUrls(saved.url).site,
				keyPair: saved.keyPair,
			};
		}
	} catch {
		// An invalid saved connection must not block entering a new one.
	}
	return null;
}

/** Keep enrollment and retries tied to the same tab and normalized live URL. */
function rememberConnection(
	slug: string,
	url: string,
	keyPair: ReprintKeyPair
): void {
	try {
		sessionStorage.setItem(
			`playground-reprint:${slug}`,
			JSON.stringify({ url, keyPair })
		);
	} catch {
		// Transfers still work when browser storage is unavailable.
	}
}
