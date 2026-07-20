import { useEffect, useState } from 'react';
import { Notice, __experimentalText as Text } from '@wordpress/components';
import { useAppDispatch, useAppSelector } from '../../lib/state/redux/store';
import {
	setActiveModal,
	setSiteSlugToDelete,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { Modal } from '../modal';
import ModalButtons from '../modal/modal-buttons';
import css from '../modal/style.module.css';

export function DeleteSiteModal() {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const siteSlugToDelete = useAppSelector(
		(state) => state.ui.siteSlugToDelete
	);
	const site = useAppSelector((state) =>
		siteSlugToDelete ? state.sites.entities[siteSlugToDelete] : undefined
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!site) {
			dispatch(setActiveModal(null));
			dispatch(setSiteSlugToDelete(undefined));
		}
	}, [site, dispatch]);

	if (!site) {
		return null;
	}

	const closeModal = () => {
		dispatch(setActiveModal(null));
		dispatch(setSiteSlugToDelete(undefined));
	};

	const handleSubmit = async () => {
		try {
			setIsSubmitting(true);
			setError(null);
			await sitesAPI.delete(site.slug);
			closeModal();
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: 'Deleting failed. Please try again.'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Deleting a local-folder Playground only forgets the link — the folder
	// and its files stay on disk. Say so instead of implying data loss.
	const isLocalFolderSite = site.metadata.storage === 'local-fs';

	return (
		<Modal
			title={
				isLocalFolderSite ? 'Remove Playground' : 'Delete Playground'
			}
			contentLabel='This is a dialog window which overlays the main content of the page. The modal begins with a heading 2 called "Delete Playground". Pressing the Close button will close the modal and bring you back to where you were on the page.'
			onRequestClose={closeModal}
			small
		>
			<form
				className={css.modalForm}
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<Text>
					{isLocalFolderSite ? (
						<>
							Are you sure you want to remove &ldquo;
							{site.metadata.name}&rdquo; from Playground? The
							folder and its files stay on this computer — only
							Playground&rsquo;s link to it is removed.
						</>
					) : (
						<>
							Are you sure you want to delete the site &ldquo;
							{site.metadata.name}&rdquo;? This action cannot be
							undone.
						</>
					)}
				</Text>
				{error ? (
					<Notice status="error" isDismissible={false}>
						{error}
					</Notice>
				) : null}
				<ModalButtons
					submitText={isLocalFolderSite ? 'Remove' : 'Delete'}
					areBusy={isSubmitting}
					onCancel={closeModal}
				/>
			</form>
		</Modal>
	);
}
