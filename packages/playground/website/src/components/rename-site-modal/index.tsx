import React, { useMemo, useState } from 'react';
import { TextControl } from '@wordpress/components';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	setActiveModal,
	setSiteSlugToRename,
} from '../../lib/state/redux/slice-ui';
import { updateSiteMetadata } from '../../lib/state/redux/slice-sites';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';

export function RenameSiteModal() {
	const dispatch = useAppDispatch();
	const siteSlugToRename = useAppSelector(
		(state) => state.ui.siteSlugToRename
	);
	const site = useAppSelector((state) =>
		siteSlugToRename ? state.sites.entities[siteSlugToRename] : undefined
	);

	const initialName = useMemo(() => site?.metadata?.name ?? '', [site]);
	const [name, setName] = useState<string>(initialName);
	const [isSubmitting, setIsSubmitting] = useState(false);

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
			await dispatch(
				updateSiteMetadata({
					slug: site.slug,
					changes: { name: trimmed },
				}) as any
			);
			closeModal();
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
				style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
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
