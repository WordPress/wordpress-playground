import {
	Button,
	Modal,
	__experimentalInputControl as InputControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import css from './style.module.css';
import { useRef, useState } from '@wordpress/element';
import { Site } from '../site-manager-sidebar';
import classNames from 'classnames';

export function AddSiteButton({
	onAddSite,
	defaultName = 'my site',
	sites,
}: {
	onAddSite: (siteName: string) => void;
	defaultName?: string;
	sites: Site[];
}) {
	const [isModalOpen, setModalOpen] = useState(false);
	const [siteName, setSiteName] = useState<string | undefined>(defaultName);
	const addSiteButtonRef = useRef<HTMLFormElement>(null);
	const [error, setError] = useState<string | undefined>(undefined);

	const openModal = () => setModalOpen(true);
	const closeModal = () => {
		setSiteName(defaultName);
		setModalOpen(false);
	};

	const validateSiteName = (newSiteName?: string) => {
		if (!newSiteName) {
			setError('Name is required');
			return false;
		}
		if (
			sites.some(
				(site) => site.name.toLowerCase() === newSiteName.toLowerCase()
			)
		) {
			setError('Name already exists');
			return false;
		}
		setError(undefined);
		return true;
	};

	const addSite = () => {
		if (!validateSiteName(siteName)) {
			return;
		}
		onAddSite(siteName!);
		closeModal();
	};

	const onEnterPress = (event: React.KeyboardEvent) => {
		if (event.key !== 'Enter') {
			return;
		}
		if (!addSiteButtonRef.current) {
			return;
		}
		addSiteButtonRef.current.click();
	};

	const onSiteNameChange = (nextValue?: string) => {
		validateSiteName(nextValue);
		setSiteName(nextValue);
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
					<VStack>
						<InputControl
							label="Name"
							value={siteName}
							onChange={(nextValue) =>
								onSiteNameChange(nextValue)
							}
							help={error}
							className={classNames(css.addSiteInput, {
								[css.invalidInput]: !!error,
							})}
							placeholder="my site"
							onKeyDown={onEnterPress}
							autoFocus={true}
							data-1p-ignore
						/>
						<HStack
							justify="flex-end"
							className={css.addSiteActions}
						>
							<Button variant="tertiary" onClick={closeModal}>
								Cancel
							</Button>
							<Button
								variant="primary"
								disabled={!!error}
								onClick={addSite}
								ref={addSiteButtonRef}
							>
								Add site
							</Button>
						</HStack>
					</VStack>
				</Modal>
			)}
		</div>
	);
}
