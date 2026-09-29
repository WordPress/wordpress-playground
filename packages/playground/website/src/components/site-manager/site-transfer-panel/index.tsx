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
import { readReprintConnection } from '../../../lib/reprint/connection';
import {
	setDockOperationNotice,
	setDockPaneOpen,
	setDockPaneSection,
	setCloneRequested,
	setPendingClone,
	setSitePullRequest,
} from '../../../lib/state/redux/slice-ui';
import {
	selectAllSites,
	updateSiteMetadata,
} from '../../../lib/state/redux/slice-sites';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';
import {
	deriveSlugFromSiteName,
	getUniqueSiteSlug,
} from '../../../lib/state/redux/site-slug';
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
	transferSite,
	REPRINT_VERSION,
	type ReprintAvailability,
	type TransferProgress,
} from '../../../lib/reprint/reprint';

export function SiteTransferPanel({
	site,
	playground,
	isVisible,
	onBackChange,
	onCloseBlockedChange,
}: SiteToolPanelProps) {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const requestedSite = useAppSelector(
		(state) => state.ui.pullRequestedForSite
	);
	// Clone mode collects a live site before any Playground exists for it. The
	// current site only hosts the form; the pull runs in a new Playground.
	const cloning = !!useAppSelector((state) => state.ui.cloneRequested);
	const pendingClone = useAppSelector((state) => state.ui.pendingClone);
	const existingSlugs = useAppSelector(selectAllSites).map(
		(existing) => existing.slug
	);
	const handoff = pendingClone?.slug === site.slug ? pendingClone : null;
	const [url, setUrl] = useState(() =>
		cloning
			? ''
			: (handoff?.url ?? rememberedConnection(site.slug)?.url ?? '')
	);
	const [secret, setSecret] = useState(() =>
		cloning
			? ''
			: (handoff?.secret ?? rememberedConnection(site.slug)?.secret ?? '')
	);
	const [step, setStep] = useState<'site' | 'install' | 'key' | 'transfer'>(
		handoff ? 'transfer' : 'site'
	);
	// A clone handoff pulls as soon as the new Playground can run PHP.
	const [autoStart, setAutoStart] = useState(!!handoff);
	const heading = useRef<HTMLHeadingElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const [setup, setSetup] = useState<
		ReprintAvailability | 'checking' | 'manual' | null
	>(handoff ? 'manual' : null);
	const checkController = useRef<AbortController>();
	const urlEdited = useRef(false);
	const [hasRememberedKey, setHasRememberedKey] = useState(!!handoff);
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const [progress, setProgress] = useState<TransferProgress>({ message: '' });
	const [error, setError] = useState('');
	const visibleError = error || (busy ? progress.error : undefined);
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
	const links =
		setup && setup !== 'checking' ? getReprintAdminUrls(url) : null;
	const hostname = links ? new URL(links.site).hostname : '';
	const acceptsKey =
		setup === 'configured' || setup === 'needs-key' || setup === 'manual';
	const keyReady = acceptsKey && !!secret.trim();
	const ready =
		playground &&
		site.metadata.runtimeConfiguration.networking &&
		Number.parseFloat(site.metadata.runtimeConfiguration.phpVersion) >= 8.1;

	useEffect(() => {
		if (!isVisible) {
			urlEdited.current = false;
			return;
		}
		if (cloning || !playground || running.current) return;
		let cancelled = false;
		void readReprintConnection(playground)
			.then((connection) => {
				if (cancelled || !connection || urlEdited.current) return;
				const address = getReprintAdminUrls(connection).site;
				const saved = rememberedConnection(site.slug);
				setUrl(address);
				setSecret(saved?.url === address ? saved.secret : '');
				setSetup('manual');
				setCompleted(false);
				setError('');
				setStep('key');
				// A missing key requires submitting the form, not starting a pull
				// as soon as the user types the first character.
				setHasRememberedKey(
					saved?.url === address && !!saved.secret.trim()
				);
			})
			.catch(() => {
				// Invalid saved URLs must not block entering a new address.
			});
		return () => {
			cancelled = true;
		};
	}, [isVisible, playground, site.slug, cloning]);

	useEffect(() => () => checkController.current?.abort(), []);

	// The handoff is read once, when this panel mounts for the new Playground.
	// Forget it so later visits to the pane start from the saved connection.
	useEffect(() => {
		if (handoff) dispatch(setPendingClone(undefined));
	}, [handoff, dispatch]);

	useEffect(() => {
		if (!isVisible) return;
		const input = content.current?.querySelector<HTMLInputElement>(
			'input:not([disabled]):not([type=checkbox])'
		);
		if (input) input.focus();
		else heading.current?.focus();
	}, [step, isVisible, busy, completed]);

	useEffect(() => {
		if (!busy) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [busy]);

	const changeUrl = (value: string) => {
		urlEdited.current = true;
		checkController.current?.abort();
		setUrl(value);
		setSetup(null);
		setStep('site');
		setSecret('');
		setError('');
		setCompleted(false);
	};

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
					!secret && saved?.url === address ? saved.secret : '';
				if (savedKey) {
					setSecret(savedKey);
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

	const goBack = useCallback(() => {
		checkController.current?.abort();
		setAutoStart(false);
		dispatch(setSitePullRequest(undefined));
		setError('');
		if (step === 'site') {
			dispatch(setCloneRequested(false));
			dispatch(setDockPaneSection('new'));
			return;
		}
		if (step === 'transfer') {
			setStep('key');
		} else {
			setSetup(null);
			setStep('site');
		}
	}, [dispatch, step]);

	const start = useCallback(async () => {
		if (!playground || !ready || !keyReady || running.current) return;
		running.current = true;
		dispatch(setSitePullRequest(undefined));
		setHasRememberedKey(false);
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
			const result = await transferSite(
				playground,
				'pull',
				url,
				secret,
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
			setCompleted(true);
			setSetup('configured');
			// The site is usable now. Persisting it to this browser happens in
			// the background; the address bar's save indicator reports it.
			void sitesAPI.autosaveTemporarySite(site.slug).catch((error) => {
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
				// Stopped on request: the key step offers to resume later.
				setStep('key');
				return;
			}
			const message =
				error instanceof Error ? error.message : String(error);
			// Resuming with the same wrong token would fail the same way.
			setStep(
				message.startsWith('Wrong connection token')
					? 'key'
					: 'transfer'
			);
			setError(message);
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
		secret,
		sitesAPI,
	]);

	// A pull rewrites the site underneath the Playground, and switching sites
	// would end its PHP runtime. Pin the pane until it completes or is stopped.
	useEffect(() => {
		onCloseBlockedChange?.(busy || (step === 'transfer' && !completed));
		return () => onCloseBlockedChange?.(false);
	}, [busy, step, completed, onCloseBlockedChange]);

	useEffect(() => {
		if (!isVisible || !autoStart || !ready || !keyReady) return;
		setAutoStart(false);
		void start();
	}, [isVisible, autoStart, ready, keyReady, start]);

	useEffect(() => {
		if (!isVisible || requestedSite !== site.slug) return;
		if (running.current) {
			dispatch(setSitePullRequest(undefined));
			return;
		}
		if (hasRememberedKey && ready && keyReady) void start();
	}, [
		isVisible,
		requestedSite,
		site.slug,
		hasRememberedKey,
		ready,
		keyReady,
		start,
		dispatch,
	]);

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
		const slug = getUniqueSiteSlug(
			deriveSlugFromSiteName(randomSiteName()),
			{ unavailableSlugs: existingSlugs }
		);
		try {
			sessionStorage.setItem(
				`playground-reprint:${slug}`,
				JSON.stringify({ url: address, secret })
			);
		} catch {
			// Transfers still work when browser storage is unavailable.
		}
		dispatch(setPendingClone({ slug, url: address, secret }));
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
				dispatch(
					setPendingClone({ slug: created, url: address, secret })
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

	const copyTransferLog = useCallback(async () => {
		if (!playground || readingDiagnostics) return;
		setReadingDiagnostics(true);
		setDiagnostics('');
		try {
			const report = await getTransferDiagnostics(playground, secret);
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
	}, [playground, readingDiagnostics, secret, dispatch]);

	// The transfer log is a support tool, so it hides behind an overflow menu
	// rather than sitting beside the primary actions. Memoized: the header
	// effect below reports it upward, and a fresh element every render would
	// loop that update.
	const transferLogMenu = useMemo(
		() =>
			playground &&
			!cloning && (
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
		[playground, cloning, readingDiagnostics, copyTransferLog]
	);

	useLayoutEffect(() => {
		if (!isVisible) return;
		onBackChange?.(
			busy
				? { title: `Pulling ${hostname}`, action: transferLogMenu }
				: completed
					? // The result screen names the site itself and needs no header.
						{ title: 'Site cloned', hideHeader: true }
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
											? 'Back to connection key'
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
	]);

	return (
		<VStack spacing={4} className={css.panel}>
			{step === 'install' && <p className={css.siteAddress}>{url}</p>}
			<div
				ref={content}
				key={`${step}-${busy}-${completed}`}
				className={css.stepContent}
			>
				{visibleError && (
					<Notice status="error" isDismissible={false}>
						<p>{visibleError}</p>
						{!busy && step === 'transfer' && keyReady && (
							<div className={css.actions}>
								<Button
									variant="secondary"
									autoFocus={isVisible}
									onClick={() => void start()}
								>
									{progress.phase === 'files-prepare'
										? 'Resume local setup'
										: 'Try resuming'}
								</Button>
							</div>
						)}
					</Notice>
				)}
				{!busy && !completed && autoStart && !visibleError && (
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
							{cloning && (
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
					<VStack spacing={4} ref={heading} tabIndex={-1}>
						<Notice status="error" isDismissible={false}>
							<strong className={css.errorTitle}>
								{setup === 'unreachable'
									? 'Couldn’t check this site'
									: 'Reprint Server not detected'}
							</strong>
							<p>
								{setup === 'unreachable'
									? 'Check the URL and try again, or follow the setup steps below.'
									: 'Install and activate Reprint Server on your live site, then check again.'}
							</p>
							<p>
								Already installed? Make sure it’s active. If
								your host blocks the check, you can enter a key
								below.
							</p>
						</Notice>
						<VStack as="ol" spacing={3} className={css.steps}>
							<li>
								<a
									href={`https://github.com/WordPress/reprint/releases/download/${REPRINT_VERSION}/reprint-exporter-wp.zip`}
									target="_blank"
									rel="noreferrer"
								>
									Download Reprint Server (.zip)
								</a>
								. Keep the file zipped.
							</li>
							<li>
								<a
									href={links.install}
									target="_blank"
									rel="noreferrer"
								>
									Open your plugin installer
								</a>{' '}
								and sign in if asked. Choose the zip, click{' '}
								<strong>Install Now</strong>, then{' '}
								<strong>Activate Plugin</strong>.
							</li>
							<li>Come back here and check again.</li>
						</VStack>
						<div className={css.actions}>
							<Button
								variant="primary"
								onClick={() => void checkSite()}
							>
								I’ve activated Reprint — check again
							</Button>
							<Button
								variant="tertiary"
								onClick={() => {
									setSetup('manual');
									setStep('key');
								}}
							>
								Reprint is installed — enter a key
							</Button>
						</div>
					</VStack>
				)}
				{!busy && !completed && step === 'key' && links && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (cloning) {
								void cloneIntoNewSite();
								return;
							}
							if (keyReady && ready) {
								try {
									sessionStorage.setItem(
										`playground-reprint:${site.slug}`,
										JSON.stringify({
											url: getReprintAdminUrls(url).site,
											secret,
										})
									);
								} catch {
									// Transfers still work when browser storage is unavailable.
								}
								void start();
							}
						}}
					>
						<VStack spacing={3}>
							<p className={css.siteConfirmed}>
								<Icon icon={check} size={20} />
								{setup === 'manual'
									? 'Site address saved. The Reprint check was skipped.'
									: 'Reprint Server found on this site.'}
							</p>
							<div className={css.siteForm}>
								<TextControl
									__nextHasNoMarginBottom
									className={css.heroInput}
									autoFocus={isVisible}
									label={`Reprint key on ${hostname}`}
									type="password"
									autoComplete="off"
									value={secret}
									onChange={setSecret}
									disabled={busy}
								/>
								<Button
									type="submit"
									variant="primary"
									disabled={!keyReady || (!cloning && !ready)}
								>
									{cloning ? 'Clone site' : 'Pull site'}
								</Button>
							</div>
							<p className={css.hint}>
								{setup === 'needs-key'
									? 'Reprint Server has no key yet. Create one in '
									: 'Copy the key from '}
								<a
									href={links.settings}
									target="_blank"
									rel="noreferrer"
								>
									Reprint settings
								</a>{' '}
								in your live site’s wp-admin, then paste it
								here.
							</p>
							{!cloning && (
								<PlaygroundBootNotice show={!playground} />
							)}
							{!cloning && !ready && playground && (
								<Notice status="info" isDismissible={false}>
									Enable networking and use PHP 8.1 or newer.
								</Notice>
							)}
							<p className={css.hint}>
								{cloning
									? 'The copy can include private data from your site. Keep this tab open until it finishes.'
									: 'Local edits may be replaced. Keep this tab open until the pull finishes.'}
							</p>
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
				{busy && !confirmStop && (
					<div className={css.actionsEnd}>
						<Button
							variant="tertiary"
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
						<h3 className={css.doneTitle}>{hostname} cloned</h3>
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
						<br />
						This copy is being saved to your browser in the
						background.
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

function rememberedConnection(
	slug: string
): { url: string; secret: string } | null {
	try {
		const saved = JSON.parse(
			sessionStorage.getItem(`playground-reprint:${slug}`) ?? 'null'
		);
		if (
			typeof saved?.url === 'string' &&
			typeof saved?.secret === 'string'
		) {
			return {
				url: getReprintAdminUrls(saved.url).site,
				secret: saved.secret,
			};
		}
	} catch {
		// An invalid saved connection must not block entering a new one.
	}
	return null;
}
