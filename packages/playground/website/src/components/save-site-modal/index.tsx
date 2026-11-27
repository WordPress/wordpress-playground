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
import { __, sprintf } from '@wordpress/i18n';
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
	type SiteStorageType,
} from '../../lib/state/redux/slice-sites';
import { logger } from '@php-wasm/logger';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';

type StorageOption = Extract<SiteStorageType, 'opfs' | 'local-fs'>;

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
		site && (site.metadata.storage === 'none' || isAutosaved);
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
		? __(
				'Open this Playground to save it to a local directory',
				'playground-website'
			)
		: localFsAvailability === 'not-available'
			? __('Not available in this browser', 'playground-website')
			: __('Not available on this site', 'playground-website');

	const chooseStorage = (storage: StorageOption) => {
		if (storage === 'local-fs' && !localIsAvailable) {
			return;
		}
		if (storage === 'opfs' && !isOpfsAvailable) {
			return;
		}
		setSelectedStorage(storage);
		setSubmitError(null);
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
				__(
					'Directory selection is not supported in this browser.',
					'playground-website'
				)
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
					__(
						'Allow Playground to edit that directory in the browser prompt to continue.',
						'playground-website'
					)
				);
			} else {
				setDirectoryError(null);
			}
		} catch (error: any) {
			if (error?.name === 'AbortError') {
				return;
			}
			logger.error(error);
			setDirectoryError(
				__(
					'Unable to access the selected directory.',
					'playground-website'
				)
			);
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

			if (selectedStorage === 'local-fs') {
				if (!targetIsActive) {
					setDirectoryError(
						__(
							'Open this Playground to save it to a local directory.',
							'playground-website'
						)
					);
					setIsSubmitting(false);
					return;
				}
				if (!directoryHandle) {
					setDirectoryError(
						__(
							'Choose a directory to continue.',
							'playground-website'
						)
					);
					setIsSubmitting(false);
					return;
				}
				const permission = await ensureWriteAccess(directoryHandle);
				setDirectoryPermission(permission);
				if (permission !== 'granted') {
					setDirectoryError(
						__(
							'Allow Playground to edit that directory in the browser prompt to continue.',
							'playground-website'
						)
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
					: __(
							'Saving failed. Please try again.',
							'playground-website'
						)
			);
			setIsSubmitting(false);
		}
	};

	const trimmedName = name.trim();
	const selectionIsAvailable =
		(selectedStorage === 'opfs' && isOpfsAvailable) ||
		(selectedStorage === 'local-fs' && localIsAvailable);
	const hasDirectoryAccess =
		selectedStorage === 'local-fs'
			? !!directoryHandle && directoryPermission === 'granted'
			: true;
	const saveDisabled =
		!trimmedName ||
		!selectionIsAvailable ||
		!hasDirectoryAccess ||
		isSaving;
	const savingProgressLabel =
		savingProgress &&
		savingProgress.total > 0 &&
		savingProgress.files >= savingProgress.total
			? __('Finalizing save...', 'playground-website')
			: savingProgress
				? sprintf(
						/* translators: 1: Number of files saved so far, 2: Total number of files to save. */
						__('Saving %1$d / %2$d files...', 'playground-website'),
						savingProgress.files,
						savingProgress.total
					)
				: __('Preparing to save...', 'playground-website');

	const handleRequestClose = () => {
		const closeIsBlocked = asPane ? isSubmitting : isSaving;
		if (!closeIsBlocked) {
			closeSurface();
		}
	};

	const browserStorageLabel = asPane
		? __('Save in browser storage', 'playground-website')
		: __('Save in this browser', 'playground-website');
	const localStorageLabel = asPane
		? __('Save in a local directory', 'playground-website')
		: __('Save to a local directory', 'playground-website');

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
					{isAutosaved
						? __(
								'This Playground is autosaved in this browser and may be removed after newer autosaves. Store it permanently in this browser or save it to a local directory.',
								'playground-website'
							)
						: asPane
							? __(
									'This Playground is temporary and will be lost when you refresh or close this page. Store it permanently in this browser or save it to a local directory to keep your work and find it later in Your Playgrounds.',
									'playground-website'
								)
							: __(
									'This Playground is temporary and will be lost when you refresh or close this page. Save it to keep your work and find it later in Your Playgrounds.',
									'playground-website'
								)}
				</p>
				<TextControl
					label={__('Playground name', 'playground-website')}
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
					label={__('Storage location', 'playground-website')}
					selected={selectedStorage}
					options={[
						{
							label: isOpfsAvailable
								? browserStorageLabel
								: sprintf(
										/* translators: %s: Storage option label. */
										__(
											'%s (not available)',
											'playground-website'
										),
										browserStorageLabel
									),
							value: 'opfs',
						},
						{
							label: localIsAvailable
								? localStorageLabel
								: sprintf(
										/* translators: %s: Storage option label. */
										__(
											'%s (not available)',
											'playground-website'
										),
										localStorageLabel
									),
							value: 'local-fs',
						},
					]}
					onChange={(value) => chooseStorage(value as StorageOption)}
					disabled={isSaving}
				/>
				{!isOpfsAvailable && selectedStorage === 'opfs' && (
					<p style={helpTextStyle}>
						{__(
							'Not available in this browser',
							'playground-website'
						)}
					</p>
				)}
				{!localIsAvailable && selectedStorage === 'local-fs' && (
					<p style={helpTextStyle}>{localUnavailableMessage}</p>
				)}
				{selectedStorage === 'local-fs' && (
					<BaseControl
						label={__('Local directory', 'playground-website')}
					>
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
								placeholder={__(
									'Choose a directory...',
									'playground-website'
								)}
								style={{ flexGrow: 1 }}
							/>
							<Button
								type="button"
								variant="secondary"
								onClick={handlePickDirectory}
								disabled={isSaving}
							>
								{__('Choose...', 'playground-website')}
							</Button>
						</div>
						{directoryError ? (
							<Notice status="error" isDismissible={false}>
								{directoryError}
							</Notice>
						) : null}
					</BaseControl>
				)}
				{isSaving && (
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
					submitText={__('Save', 'playground-website')}
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
			title={__('Save Playground', 'playground-website')}
			contentLabel={__('Save Playground', 'playground-website')}
			onRequestClose={onRequestClose}
			isDismissible={isDismissible}
			small
		>
			{children}
		</Modal>
	);
}
