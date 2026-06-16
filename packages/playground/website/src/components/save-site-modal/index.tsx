import {
	useEffect,
	useMemo,
	useState,
	useRef,
	type CSSProperties,
	type ReactElement,
} from 'react';
import {
	Button,
	BaseControl,
	TextControl,
	RadioControl,
	Notice,
} from '@wordpress/components';
import { Icon, backup, cautionFilled } from '@wordpress/icons';
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

const helpTextStyle: CSSProperties = {
	color: '#757575',
	fontSize: 12,
	marginTop: 8,
};

// Echoes the dock status pill the user clicked, so the pane reads as a direct
// continuation of "Autosaved"/"Unsaved" rather than an unrelated dialog.
const statusChipStyle: CSSProperties = {
	alignItems: 'center',
	alignSelf: 'flex-start',
	borderRadius: 999,
	display: 'inline-flex',
	fontSize: 12,
	fontWeight: 600,
	gap: 4,
	lineHeight: 1.2,
	padding: '3px 10px 3px 6px',
};

/**
 * Hosts the save form either in the centered Modal (default) or, when embedded
 * in the dock's "Store permanently" pane, as a bare passthrough so the pane
 * supplies the chrome.
 */
function SaveSurface({
	asPane,
	isSaving,
	onRequestClose,
	children,
}: {
	asPane: boolean;
	isSaving: boolean;
	onRequestClose: () => void;
	children: ReactElement;
}) {
	if (asPane) {
		return children;
	}
	return (
		<Modal
			title="Save Playground"
			contentLabel="Save Playground"
			onRequestClose={onRequestClose}
			isDismissible={!isSaving}
			small
		>
			{children}
		</Modal>
	);
}

export function SaveSiteModal({
	asPane = false,
	onClose,
}: {
	/**
	 * Render the bare form for embedding in a dock pane ("Store permanently")
	 * instead of the centered Modal. The host pane supplies the title + close.
	 */
	asPane?: boolean;
	onClose?: () => void;
} = {}) {
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
		// Select the text in the name input when the modal is shown
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
	const closeModal = () => {
		if (asPane) {
			onClose?.();
			return;
		}
		dispatch(setActiveModal(null));
		dispatch(setSiteSlugToSave(undefined));
	};

	useEffect(() => {
		if (site && canSaveSite) {
			return;
		}
		if (asPane) {
			onClose?.();
		} else {
			dispatch(setActiveModal(null));
			dispatch(setSiteSlugToSave(undefined));
		}
	}, [asPane, canSaveSite, dispatch, onClose, site]);

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

			if (selectedStorage === 'local-fs') {
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

			closeModal();
		} catch (error) {
			logger.error(error);
			setSubmitError(
				error instanceof Error
					? error.message
					: 'Saving failed. Please try again.'
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
			? 'Finalizing save...'
			: savingProgress
				? `Saving ${savingProgress.files} / ${savingProgress.total} files...`
				: 'Preparing to save...';

	const handleRequestClose = () => {
		if (!isSaving) {
			closeModal();
		}
	};

	return (
		<SaveSurface
			asPane={asPane}
			isSaving={isSaving}
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
					// In the dock pane the form supplies its own padding so its
					// content lines up with the pane header (the Modal handles
					// this itself). Matches the other panes' 24px side padding.
					...(asPane && {
						padding: 'var(--space-2) var(--space-6) var(--space-6)',
					}),
				}}
				autoComplete="off"
			>
				{asPane && (
					<span
						style={{
							...statusChipStyle,
							background: isAutosaved
								? 'rgba(56, 88, 233, 0.1)'
								: 'rgba(176, 124, 11, 0.14)',
							color: isAutosaved ? '#2645c9' : '#8a5a00',
						}}
					>
						<Icon
							icon={isAutosaved ? backup : cautionFilled}
							size={16}
						/>
						{isAutosaved ? 'Autosaved' : 'Unsaved'}
					</span>
				)}
				<p style={{ margin: 0, color: '#1e1e1e' }}>
					{isAutosaved
						? 'This Playground is autosaved in this browser and may be removed after newer autosaves. Store it permanently in this browser or save it to a local directory.'
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
								'Save in this browser' +
								(!isOpfsAvailable ? ' (not available)' : ''),
							value: 'opfs',
						},
						{
							label:
								'Save to a local directory' +
								(!localIsAvailable ? ' (not available)' : ''),
							value: 'local-fs',
						},
					]}
					onChange={(value) => chooseStorage(value as StorageOption)}
					disabled={isSaving}
				/>
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
				{isSaving && (
					<div>
						<progress
							id="save-progress"
							max={savingProgress?.total || 100}
							value={savingProgress?.files || 0}
							style={{ width: '100%', height: 24 }}
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
					submitText="Save"
					onCancel={handleRequestClose}
					areDisabled={saveDisabled}
					areBusy={false}
					style={{ marginTop: 0 }}
				/>
			</form>
		</SaveSurface>
	);
}
