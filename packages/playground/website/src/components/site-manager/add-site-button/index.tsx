import {
	Button,
	Modal,
	__experimentalInputControl as InputControl,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import css from './style.module.css';
import { useRef, useState } from '@wordpress/element';
import classNames from 'classnames';
import {
	createSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/redux-store';
import { useCurrentUrl } from '../../../lib/router-hooks';
import {
	createNewSiteInfo,
	generateUniqueSiteName,
	randomSiteName,
} from '../../../lib/site-storage';

export function AddSiteButton() {
	const [isModalOpen, setModalOpen] = useState(false);
	const [siteName, setSiteName] = useState<string>(randomSiteName());
	const addSiteButtonRef = useRef<HTMLFormElement>(null);
	const [error, setError] = useState<string | undefined>(undefined);
	const dispatch = useAppDispatch();
	const sites = useAppSelector((state) => state.siteListing?.sites);

	const [, setUrlComponents] = useCurrentUrl();

	const onAddSite = async (name: string) => {
		const newSiteInfo = await createNewSiteInfo({
			storage: 'opfs',
			metadata: {
				name: name,
			},
		});
		dispatch(createSite(newSiteInfo));
		setUrlComponents({
			searchParams: { 'site-slug': newSiteInfo.slug, storage: 'opfs' },
		});
	};

	const openModal = () => {
		setSiteName(generateUniqueSiteName(siteName, sites));
		setModalOpen(true);
	};
	const closeModal = () => {
		setModalOpen(false);
	};

	const validateSiteName = (newSiteName?: string) => {
		if (!newSiteName) {
			setError('Name is required');
			return false;
		}
		// @TODO: Lift this constraint. If the user wants multiple sites with the same name,
		//        let them do it.
		if (
			sites.some(
				(site) =>
					site.metadata.name.toLowerCase() ===
					newSiteName.toLowerCase()
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
							onChange={(nextValue) => {
								validateSiteName(nextValue);
								setSiteName(nextValue ?? '');
							}}
							help={error}
							className={classNames(css.addSiteInput, {
								[css.invalidInput]: !!error,
							})}
							placeholder="Site name"
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
