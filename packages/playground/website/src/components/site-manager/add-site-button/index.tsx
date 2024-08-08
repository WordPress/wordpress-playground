import {
	Button,
	Modal,
	__experimentalInputControl as InputControl,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import css from './style.module.css';
import { useState } from '@wordpress/element';
import classNames from 'classnames';

export function AddSiteButton({
	onAddSite,
}: {
	onAddSite: (siteName: string) => void;
}) {
	const [isModalOpen, setModalOpen] = useState(false);
	const [siteName, setSiteName] = useState<string | undefined>(undefined);

	const openModal = () => setModalOpen(true);
	const closeModal = () => {
		setSiteName(undefined);
		setModalOpen(false);
	};
	const isValidSiteName = (newSiteName?: string) => {
		if (!newSiteName) {
			return false;
		}
		/**
		 * We currently only allow lowercase letters, numbers, and spaces.
		 *
		 * This allows us to convert the site name to a site slug.
		 * TODO: auto-generate site slug and save site name as-is in site storage
		 */
		return /^[a-z0-9 ]+$/.test(newSiteName);
	};

	const onAddSiteClick = () => {
		if (!siteName) {
			return;
		}
		onAddSite(siteName);
		closeModal();
	};

	const maybeSetSiteName = (nextValue?: string) => {
		if (!nextValue) {
			setSiteName(undefined);
			return;
		}
		nextValue = nextValue.trim();
		if (isValidSiteName(nextValue)) {
			setSiteName(nextValue);
		}
	};

	return (
		<div className={css.addSiteButton}>
			<Button
				variant="primary"
				className={css.addSiteButtonComponent}
				onClick={openModal}
			>
				Add site
			</Button>

			{isModalOpen && (
				<Modal title="Add site" onRequestClose={closeModal}>
					<InputControl
						label="Site name"
						value={siteName}
						onChange={(nextValue) => maybeSetSiteName(nextValue)}
						placeholder="my site"
						help="Can be lowercase letters, numbers, and spaces."
						className={classNames(css.addSiteInput, {
							[css.invalidInput]:
								// We don't want to show the error message if the site name is empty
								!isValidSiteName(siteName) && siteName,
						})}
					/>
					<HStack justify="flex-end">
						<Button variant="tertiary" onClick={closeModal}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={onAddSiteClick}
							disabled={!isValidSiteName(siteName)}
						>
							Add site
						</Button>
					</HStack>
				</Modal>
			)}
		</div>
	);
}
