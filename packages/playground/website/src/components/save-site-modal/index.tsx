import {
	useEffect,
	useMemo,
	useState,
	useRef,
	type CSSProperties,
} from 'react';
import {
	Button,
	BaseControl,
	TextControl,
	RadioControl,
} from '@wordpress/components';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { selectClientInfoBySiteSlug } from '../../lib/state/redux/slice-clients';
import { persistTemporarySite } from '../../lib/state/redux/persist-temporary-site';
import type { SiteStorageType } from '../../lib/state/redux/slice-sites';
import { logger } from '@php-wasm/logger';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';

type StorageOption = Extract<SiteStorageType, 'opfs' | 'local-fs'>;

const helpTextStyle: CSSProperties = {
	color: '#757575',
	fontSize: 12,
	marginTop: 8,
};

const errorTextStyle: CSSProperties = {
	color: '#d63638',
	marginTop: 8,
};

export function SaveSiteModal() {
	const dispatch = useAppDispatch();
	const site = useAppSelector((state) =>
		state.ui.activeSite?.slug
			? state.sites.entities[state.ui.activeSite.slug]
			: undefined
	);
	const clientInfo = useAppSelector((state) =>
		state.ui.activeSite?.slug
			? selectClientInfoBySiteSlug(state, state.ui.activeSite.slug)
			: undefined
	);

	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);

	const initialName = useMemo(() => site?.metadata?.name ?? '', [site]);
	const [name, setName] = useState(initialName);
	const [selectedStorage, setSelectedStorage] = useState<StorageOption>(
		() => {
			if (isOpfsAvailable) {
				return 'opfs';
			}
			if (localFsAvailability === 'available') {
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

	useEffect(() => {
		setName(initialName);
	}, [initialName]);

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
		if (
			selectedStorage === 'local-fs' &&
			localFsAvailability !== 'available'
		) {
			setSelectedStorage('opfs');
		}
	}, [selectedStorage, localFsAvailability]);

	useEffect(() => {
		if (
			selectedStorage === 'opfs' &&
			!isOpfsAvailable &&
			localFsAvailability === 'available'
		) {
			setSelectedStorage('local-fs');
		}
	}, [selectedStorage, localFsAvailability]);

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

	// Close modal when save completes successfully
	useEffect(() => {
		if (
			isSubmitting &&
			saveProgress?.status !== 'syncing' &&
			saveProgress?.status !== 'error' &&
			site?.metadata?.storage !== 'none'
		) {
			dispatch(setActiveModal(null));
		}
	}, [isSubmitting, saveProgress?.status, site?.metadata?.storage, dispatch]);

	if (!site || site.metadata.storage !== 'none') {
		return null;
	}

	const closeModal = () => {
		dispatch(setActiveModal(null));
	};

	const localIsAvailable = localFsAvailability === 'available';
	const localUnavailableMessage =
		localFsAvailability === 'not-available'
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
				if (!directoryHandle) {
					setDirectoryError('Choose a directory to continue.');
					return;
				}
				const permission = await ensureWriteAccess(directoryHandle);
				setDirectoryPermission(permission);
				if (permission !== 'granted') {
					setDirectoryError(
						'Allow Playground to edit that directory in the browser prompt to continue.'
					);
					return;
				}
				await dispatch(
					persistTemporarySite(site.slug, 'local-fs', {
						siteName: trimmedName,
						localFsHandle: directoryHandle,
						skipRenameModal: true,
					}) as any
				);
			} else {
				await dispatch(
					persistTemporarySite(site.slug, 'opfs', {
						siteName: trimmedName,
						skipRenameModal: true,
					}) as any
				);
			}

			// Don't close modal here - useEffect will close it when save completes
		} catch (error) {
			logger.error(error);
			setSubmitError('Saving failed. Please try again.');
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

	const handleRequestClose = () => {
		if (!isSaving) {
			closeModal();
		}
	};

	return (
		<Modal
			title="Save Playground"
			contentLabel="Save Playground"
			onRequestClose={handleRequestClose}
			isDismissible={!isSaving}
			small
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					handleSubmit();
				}}
				style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
				autoComplete="off"
			>
				<p style={{ margin: 0, color: '#1e1e1e' }}>
					This Playground is temporary and will be lost when you
					refresh or close this page. Save it to keep your work.
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
							<p style={errorTextStyle}>{directoryError}</p>
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
							{savingProgress
								? `Saving ${savingProgress.files} / ${savingProgress.total} files...`
								: 'Preparing to save...'}
						</p>
					</div>
				)}
				<ModalButtons
					submitText="Save"
					onCancel={handleRequestClose}
					areDisabled={saveDisabled}
					areBusy={false}
					style={{ marginTop: 0 }}
				/>
				{submitError ? (
					<p style={errorTextStyle}>{submitError}</p>
				) : null}
			</form>
		</Modal>
	);
}
