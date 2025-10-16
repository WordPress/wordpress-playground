import { useMemo, useState } from 'react';
import { Button, BaseControl, TextControl } from '@wordpress/components';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { persistTemporarySite } from '../../lib/state/redux/persist-temporary-site';
import { logger } from '@php-wasm/logger';

export function SaveSiteToLocalModal() {
	const dispatch = useAppDispatch();
	const site = useAppSelector((state) =>
		state.ui.activeSite?.slug
			? state.sites.entities[state.ui.activeSite.slug]
			: undefined
	);

	const initialName = useMemo(() => site?.metadata?.name ?? '', [site]);
	const [name, setName] = useState(initialName);
	const [directoryHandle, setDirectoryHandle] =
		useState<FileSystemDirectoryHandle | null>(null);
	const [directoryError, setDirectoryError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!site || site.metadata.storage !== 'none') {
		return null;
	}

	const closeModal = () => dispatch(setActiveModal(null));

	const handlePickDirectory = async () => {
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
			setDirectoryHandle(handle);
			setDirectoryError(null);
		} catch (error: any) {
			if (error?.name === 'AbortError') {
				return;
			}
			setDirectoryError('Unable to access the selected directory.');
		}
	};

	const handleSubmit = async () => {
		const trimmedName = name.trim();
		if (!trimmedName || !directoryHandle) {
			if (!directoryHandle) {
				setDirectoryError('Choose a directory to continue.');
			}
			return;
		}

		try {
			setIsSubmitting(true);
			await dispatch(
				persistTemporarySite(site.slug, 'local-fs', {
					siteName: trimmedName,
					localFsHandle: directoryHandle,
					skipRenameModal: true,
				}) as any
			);
			closeModal();
		} catch (error) {
			logger.error(error);
			setDirectoryError('Saving failed. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			title="Save Playground Locally"
			contentLabel="This dialog collects a name and directory before saving the Playground locally. Pressing Close will cancel the save."
			onRequestClose={closeModal}
			small
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					handleSubmit();
				}}
				style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
			>
				<TextControl
					label="Playground name"
					value={name}
					onChange={(value) => setName(value)}
					autoFocus
				/>
				<BaseControl label="Local directory">
					<div
						style={{
							display: 'flex',
							gap: 8,
							alignItems: 'center',
						}}
					>
						<TextControl
							value={directoryHandle?.name ?? ''}
							readOnly
							placeholder="Choose a directory..."
							style={{ flexGrow: 1 }}
							onChange={() => {
								/* required property */
							}}
						/>
						<Button
							type="button"
							variant="secondary"
							onClick={handlePickDirectory}
						>
							Choose...
						</Button>
					</div>
					{directoryError ? (
						<p style={{ color: '#d63638', marginTop: 8 }}>
							{directoryError}
						</p>
					) : null}
				</BaseControl>
				<ModalButtons
					submitText="Save"
					onCancel={closeModal}
					areDisabled={!name.trim() || !directoryHandle}
					areBusy={isSubmitting}
				/>
			</form>
		</Modal>
	);
}
