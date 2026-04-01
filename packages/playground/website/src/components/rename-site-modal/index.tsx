import { useMemo, useState } from 'react';
import { Notice, TextControl } from '@wordpress/components';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	setActiveModal,
	setSiteSlugToRename,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import css from '../modal/style.module.css';

export function RenameSiteModal() {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const siteSlugToRename = useAppSelector(
		(state) => state.ui.siteSlugToRename
	);
	const site = useAppSelector((state) =>
		siteSlugToRename ? state.sites.entities[siteSlugToRename] : undefined
	);

	const initialName = useMemo(() => site?.metadata?.name ?? '', [site]);
	const [name, setName] = useState<string>(initialName);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!site || site.metadata.storage === 'none') {
		// Nothing to rename
		return null;
	}

	const closeModal = () => {
		dispatch(setActiveModal(null));
		dispatch(setSiteSlugToRename(undefined));
	};

	const handleSubmit = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		try {
			setIsSubmitting(true);
			setError(null);
			await sitesAPI.rename(trimmed);
			closeModal();
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: 'Renaming failed. Please try again.'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			title="Rename Playground"
			contentLabel='This is a dialog window which overlays the main content of the page. The modal begins with a heading 2 called "Rename Playground". Pressing the Close button will close the modal and bring you back to where you were on the page.'
			onRequestClose={closeModal}
			small
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				className={css.modalForm}
			>
				<TextControl
					__nextHasNoMarginBottom
					label="Name"
					value={name}
					onChange={(val: string) => setName(val)}
					placeholder="e.g. Testing Gutenberg 24.17"
					maxLength={80}
					autoFocus
				/>
				{error ? (
					<Notice status="error" isDismissible={false}>
						{error}
					</Notice>
				) : null}
				<ModalButtons
					submitText="Rename"
					areDisabled={!name.trim()}
					areBusy={isSubmitting}
					onCancel={closeModal}
				/>
			</form>
		</Modal>
	);
}
