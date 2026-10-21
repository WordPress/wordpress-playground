import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	useRef,
	type CSSProperties,
	type ReactNode,
} from 'react';
import {
	Button,
	BaseControl,
	TextControl,
	RadioControl,
	Notice,
} from '@wordpress/components';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	setActiveModal,
	setSiteSlugToSave,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { selectClientInfoBySiteSlug } from '../../lib/state/redux/slice-clients';
import {
	isAutosavedSite,
	updateSiteMetadata,
	type SiteStorageType,
} from '../../lib/state/redux/slice-sites';
import { logger } from '@php-wasm/logger';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { InlineProgress } from '../pane-loading';
import {
	hasSpacefastConnection,
	saveSiteToSpacefast,
} from '../../lib/spacefast/save';
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';
import { extractSpacefastHandoffUrl } from '../../lib/spacefast/handoff';

type StorageOption =
	| Extract<SiteStorageType, 'opfs' | 'local-fs'>
	| 'spacefast';

type SaveSiteModalProps =
	| {
			/** Render the form inside the Dock instead of a standalone modal. */
			asPane: true;
			onClose: () => void;
			onCloseBlockedChange?: (isBlocked: boolean) => void;
	  }
	| {
			asPane?: false;
			onClose?: never;
			onCloseBlockedChange?: never;
	  };

const helpTextStyle: CSSProperties = {
	color: '#757575',
	fontSize: 12,
	marginTop: 8,
};

export function SaveSiteModal(props: SaveSiteModalProps = {}) {
	const { asPane = false } = props;
	const onClose = props.asPane ? props.onClose : undefined;
	const onCloseBlockedChange = props.asPane
		? props.onCloseBlockedChange
		: undefined;
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const siteSlugToSave = useAppSelector((state) => state.ui.siteSlugToSave);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	// The modal may be opened from an inactive autosave in Your Playgrounds.
	const targetSiteSlug = siteSlugToSave ?? activeSiteSlug;
	const site = useAppSelector((state) =>
		targetSiteSlug ? state.sites.entities[targetSiteSlug] : undefined
	);
	const clientInfo = useAppSelector((state) =>
		targetSiteSlug
			? selectClientInfoBySiteSlug(state, targetSiteSlug)
			: undefined
	);

	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);
	const targetIsActive = !!site && site.slug === activeSiteSlug;
	const localIsAvailable =
		targetIsActive && localFsAvailability === 'available';

	const initialName = useMemo(() => site?.metadata?.name ?? '', [site]);
	const [name, setName] = useState(initialName);
	const [selectedStorage, setSelectedStorage] = useState<StorageOption>(
		() => {
			if (site?.metadata.spacefast) return 'spacefast';
			if (isOpfsAvailable) {
				return 'opfs';
			}
			if (localIsAvailable) {
				return 'local-fs';
			}
			return 'opfs';
		}
	);
	const [directoryHandle, setDirectoryHandle] =
		useState<FileSystemDirectoryHandle | null>(null);
	const [directoryPermission, setDirectoryPermission] =
		useState<PermissionState | null>(null);
	const [directoryError, setDirectoryError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [handoff, setHandoff] = useState('');
	const [spacefastProgress, setSpacefastProgress] = useState('');
	const [spacefastResult, setSpacefastResult] = useState<string>();
	const connected = !!site && hasSpacefastConnection(site.metadata.id);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const nameSiteSlugRef = useRef<string>();

	useEffect(() => {
		if (nameSiteSlugRef.current === site?.slug) {
			return;
		}
		nameSiteSlugRef.current = site?.slug;
		setName(initialName);
	}, [initialName, site?.slug]);

	useEffect(() => {
		// Select the text in the name input when the save surface is shown
		// Use a small delay to ensure the input is focused first by autoFocus
		const timer = setTimeout(() => {
			// Try using the ref first
			if (nameInputRef.current) {
				nameInputRef.current.select();
			} else if (document.activeElement instanceof HTMLInputElement) {
				// Fallback: if autoFocus worked, the active element should be our input
				document.activeElement.select();
			}
		}, 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (selectedStorage === 'local-fs' && !localIsAvailable) {
			setSelectedStorage('opfs');
		}
	}, [selectedStorage, localIsAvailable]);

	useEffect(() => {
		if (
			selectedStorage === 'opfs' &&
			!isOpfsAvailable &&
			localIsAvailable
		) {
			setSelectedStorage('local-fs');
		}
	}, [selectedStorage, localIsAvailable]);

	useEffect(() => {
		setDirectoryHandle(null);
		setDirectoryPermission(null);
		setDirectoryError(null);
	}, [site?.slug]);

	// Monitor save progress through opfsSync status
	const saveProgress = clientInfo?.opfsSync;
	const isSaving = isSubmitting || saveProgress?.status === 'syncing';
	const savingProgress =
		saveProgress?.status === 'syncing' ? saveProgress.progress : undefined;

	const isAutosaved = site && isAutosavedSite(site);
	const canSaveSite =
		site &&
		(site.metadata.storage === 'none' ||
			isAutosaved ||
			!!site.metadata.spacefast);
	const closeSurface = useCallback(() => {
		dispatch(setSiteSlugToSave(undefined));
		if (onClose) {
			onClose();
			return;
		}
		dispatch(setActiveModal(null));
	}, [dispatch, onClose]);

	useEffect(() => {
		if (!asPane) {
			return;
		}
		// A background autosave may already be running when this pane opens.
		// Disable submission then, but only trap the pane while this form's own
		// save is in flight.
		onCloseBlockedChange?.(isSubmitting);
		return () => onCloseBlockedChange?.(false);
	}, [asPane, isSubmitting, onCloseBlockedChange]);

	useEffect(() => {
		if (site && canSaveSite) {
			return;
		}
		closeSurface();
	}, [canSaveSite, closeSurface, site]);

	if (!site || !canSaveSite) {
		return null;
	}

	const localUnavailableMessage = !targetIsActive
		? 'Open this Playground to save it to a local directory'
		: localFsAvailability === 'not-available'
			? 'Not available in this browser'
			: 'Not available on this site';

	const chooseStorage = (storage: StorageOption) => {
		if (storage === 'local-fs' && !localIsAvailable) {
			return;
		}
		if (storage === 'opfs' && !isOpfsAvailable) {
			return;
		}
		setSelectedStorage(storage);
		setSubmitError(null);
		setSpacefastResult(undefined);
		if (storage !== 'local-fs') {
			setDirectoryError(null);
		}
	};

	const requestWriteAccess = async (
		handle: FileSystemDirectoryHandle
	): Promise<PermissionState> => {
		if (typeof handle.requestPermission === 'function') {
			const result = await handle.requestPermission({
				mode: 'readwrite',
			});
			return (result ?? 'prompt') as PermissionState;
		}
		if (typeof handle.queryPermission === 'function') {
			const result = await handle.queryPermission({ mode: 'readwrite' });
			return (result ?? 'prompt') as PermissionState;
		}
		return 'granted';
	};

	const ensureWriteAccess = async (
		handle: FileSystemDirectoryHandle
	): Promise<PermissionState> => {
		if (typeof handle.queryPermission === 'function') {
			const current = await handle.queryPermission({
				mode: 'readwrite',
			});
			if (current === 'granted' || current === 'denied') {
				return current;
			}
		}
		return requestWriteAccess(handle);
	};

	const handlePickDirectory = async () => {
		setSubmitError(null);
		if (!(window as any).showDirectoryPicker) {
			setDirectoryError(
				'Directory selection is not supported in this browser.'
			);
			return;
		}
		try {
			const handle: FileSystemDirectoryHandle = await (
				window as any
			).showDirectoryPicker({
				id: 'playground-directory',
				mode: 'readwrite',
			});
			const permission = await requestWriteAccess(handle);
			setDirectoryHandle(handle);
			setDirectoryPermission(permission);
			if (permission !== 'granted') {
				setDirectoryError(
					'Allow Playground to edit that directory in the browser prompt to continue.'
				);
			} else {
				setDirectoryError(null);
			}
		} catch (error: any) {
			if (error?.name === 'AbortError') {
				return;
			}
			logger.error(error);
			setDirectoryError('Unable to access the selected directory.');
		}
	};

	const handleSubmit = async () => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			return;
		}

		try {
			setIsSubmitting(true);
			setSubmitError(null);
			setSpacefastResult(undefined);

			if (selectedStorage === 'spacefast') {
				if (!targetIsActive || !clientInfo?.client) {
					throw new Error(
						'Open this Playground and wait for it to load before saving to Spacefast.'
					);
				}
				const authorization = handoff;
				const destination = await saveSiteToSpacefast({
					site,
					playground: clientInfo.client,
					name: trimmedName,
					handoff: authorization,
					proxy: corsProxyUrl,
					onProgress: setSpacefastProgress,
				});
				await dispatch(
					updateSiteMetadata({
						slug: site.slug,
						changes: {
							name: trimmedName,
							persistence: 'explicit',
							spacefast: destination,
						},
					})
				);
				if (site.metadata.storage !== 'none') {
					redirectTo(PlaygroundRoute.site(site));
				}
				setSpacefastResult(destination.url);
				setHandoff('');
				setIsSubmitting(false);
				setSpacefastProgress('');
				return;
			} else if (selectedStorage === 'local-fs') {
				if (!targetIsActive) {
					setDirectoryError(
						'Open this Playground to save it to a local directory.'
					);
					setIsSubmitting(false);
					return;
				}
				if (!directoryHandle) {
					setDirectoryError('Choose a directory to continue.');
					setIsSubmitting(false);
					return;
				}
				const permission = await ensureWriteAccess(directoryHandle);
				setDirectoryPermission(permission);
				if (permission !== 'granted') {
					setDirectoryError(
						'Allow Playground to edit that directory in the browser prompt to continue.'
					);
					setIsSubmitting(false);
					return;
				}
				await sitesAPI.saveToLocalFileSystem(
					trimmedName,
					directoryHandle
				);
			} else {
				if (isAutosaved) {
					await sitesAPI.keep(site.slug, trimmedName);
				} else {
					await sitesAPI.saveInBrowser(trimmedName);
				}
			}

			closeSurface();
		} catch (error) {
			logger.error(error);
			setSubmitError(
				error instanceof Error
					? error.message
					: 'Saving failed. Please try again.'
			);
			setIsSubmitting(false);
			setSpacefastProgress('');
		}
	};

	const trimmedName = name.trim();
	const selectionIsAvailable =
		(selectedStorage === 'opfs' && isOpfsAvailable) ||
		(selectedStorage === 'spacefast' &&
			targetIsActive &&
			!!clientInfo?.client) ||
		(selectedStorage === 'local-fs' && localIsAvailable);
	const hasDirectoryAccess =
		selectedStorage === 'local-fs'
			? !!directoryHandle && directoryPermission === 'granted'
			: true;
	const saveDisabled =
		!trimmedName ||
		!selectionIsAvailable ||
		!hasDirectoryAccess ||
		(selectedStorage === 'spacefast' && !connected && !handoff.trim()) ||
		isSaving;
	const savingProgressLabel =
		savingProgress &&
		savingProgress.total > 0 &&
		savingProgress.files >= savingProgress.total
			? 'Finalizing save...'
			: savingProgress
				? `Saving ${savingProgress.files} / ${savingProgress.total} files...`
				: 'Preparing to save...';

	const handleRequestClose = () => {
		const closeIsBlocked = asPane ? isSubmitting : isSaving;
		if (!closeIsBlocked) {
			closeSurface();
		}
	};

	return (
		<SaveSurface
			asPane={asPane}
			isDismissible={asPane ? !isSubmitting : !isSaving}
			onRequestClose={handleRequestClose}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					handleSubmit();
				}}
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 16,
					...(asPane && {
						padding: 'var(--space-2) var(--space-6) var(--space-6)',
					}),
				}}
				autoComplete="off"
			>
				<p
					style={{
						margin: 0,
						color: asPane ? 'var(--ink)' : '#1e1e1e',
					}}
				>
					{site.metadata.spacefast
						? 'Save your current changes to this Playground’s public Spacefast site.'
						: isAutosaved
							? 'This Playground is autosaved in this browser and may be removed after newer autosaves. Store it permanently in this browser, in a local directory, or on Spacefast.'
							: asPane
								? 'Keep this Playground in this browser, in a local directory, or on Spacefast to find it again later.'
								: 'This Playground is temporary and will be lost when you refresh or close this page. Save it to keep your work and find it later in Your Playgrounds.'}
				</p>
				<TextControl
					label="Playground name"
					value={name}
					onChange={(value) => setName(value)}
					autoFocus
					ref={nameInputRef}
					data-1p-ignore="true"
					data-lpignore="true"
					data-bwignore="true"
					disabled={isSaving}
				/>
				<RadioControl
					label="Storage location"
					selected={selectedStorage}
					options={[
						{
							label:
								(asPane
									? 'Save in browser storage'
									: 'Save in this browser') +
								(!isOpfsAvailable ? ' (not available)' : ''),
							value: 'opfs',
						},
						{
							label:
								(asPane
									? 'Save in a local directory'
									: 'Save to a local directory') +
								(!localIsAvailable ? ' (not available)' : ''),
							value: 'local-fs',
						},
						{ label: 'Save to Spacefast', value: 'spacefast' },
					]}
					onChange={(value) => chooseStorage(value as StorageOption)}
					disabled={isSaving}
				/>
				{selectedStorage === 'spacefast' && (
					<>
						<p>
							Your Blueprint, complete SQLite database, and
							uploads will be publicly readable on Spacefast.
							Plugins and themes are recreated from your
							Blueprint.
						</p>
						{connected ? (
							<p>Connected to Spacefast for this tab session.</p>
						) : (
							<TextControl
								label="Spacefast handoff URL"
								type="text"
								value={handoff}
								onChange={setHandoff}
								onPaste={(event) => {
									const url = extractSpacefastHandoffUrl(
										event.clipboardData.getData('text')
									);
									if (url) {
										event.preventDefault();
										setHandoff(url);
									}
								}}
								disabled={isSaving}
								autoComplete="off"
								help="Paste a Spacefast handoff URL or the full Spacefast prompt."
							/>
						)}
						{(!targetIsActive || !clientInfo?.client) && (
							<p>
								Open this Playground and wait for it to load to
								save to Spacefast.
							</p>
						)}
						{spacefastResult && (
							<Notice status="success" isDismissible={false}>
								Saved to Spacefast.{' '}
								<a
									href={spacefastResult}
									target="_blank"
									rel="noreferrer"
								>
									Open on Spacefast
								</a>
							</Notice>
						)}
						{!spacefastResult && site.metadata.spacefast && (
							<a
								href={site.metadata.spacefast.url}
								target="_blank"
								rel="noreferrer"
							>
								Open on Spacefast
							</a>
						)}
					</>
				)}
				{!isOpfsAvailable && selectedStorage === 'opfs' && (
					<p style={helpTextStyle}>Not available in this browser</p>
				)}
				{!localIsAvailable && selectedStorage === 'local-fs' && (
					<p style={helpTextStyle}>{localUnavailableMessage}</p>
				)}
				{selectedStorage === 'local-fs' && (
					<BaseControl label="Local directory">
						<div
							style={{
								display: 'flex',
								gap: 8,
								alignItems: 'center',
							}}
						>
							<input
								type="text"
								className="components-text-control__input"
								value={directoryHandle?.name ?? ''}
								readOnly
								placeholder="Choose a directory..."
								style={{ flexGrow: 1 }}
							/>
							<Button
								type="button"
								variant="secondary"
								onClick={handlePickDirectory}
								disabled={isSaving}
							>
								Choose...
							</Button>
						</div>
						{directoryError ? (
							<Notice status="error" isDismissible={false}>
								{directoryError}
							</Notice>
						) : null}
					</BaseControl>
				)}
				{isSaving && selectedStorage === 'spacefast' && (
					<InlineProgress
						message={spacefastProgress || 'Preparing to save…'}
					/>
				)}
				{isSaving && selectedStorage !== 'spacefast' && (
					<div>
						<progress
							id="save-progress"
							max={savingProgress?.total || 100}
							value={savingProgress?.files || 0}
							style={{
								width: '100%',
								height: asPane ? 12 : 24,
								...(asPane && {
									accentColor: 'var(--accent)',
								}),
							}}
						></progress>
						<p style={{ ...helpTextStyle, marginTop: 4 }}>
							{savingProgressLabel}
						</p>
					</div>
				)}
				{submitError ? (
					<Notice status="error" isDismissible={false}>
						{submitError}
					</Notice>
				) : null}
				<ModalButtons
					submitText={
						selectedStorage === 'spacefast'
							? 'Save to Spacefast'
							: 'Save'
					}
					onCancel={handleRequestClose}
					areDisabled={saveDisabled}
					cancelDisabled={asPane ? isSubmitting : undefined}
					areBusy={false}
					style={{ marginTop: 0 }}
				/>
			</form>
		</SaveSurface>
	);
}

/** Uses the Dock pane's chrome when embedded, or the standalone modal otherwise. */
function SaveSurface({
	asPane,
	isDismissible,
	onRequestClose,
	children,
}: {
	asPane: boolean;
	isDismissible: boolean;
	onRequestClose: () => void;
	children: ReactNode;
}) {
	if (asPane) {
		return children;
	}
	return (
		<Modal
			title="Save Playground"
			contentLabel="Save Playground"
			onRequestClose={onRequestClose}
			isDismissible={isDismissible}
			small
		>
			{children}
		</Modal>
	);
}
