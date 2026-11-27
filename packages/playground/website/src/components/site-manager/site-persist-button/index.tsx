import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import css from './style.module.css';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteStorageType } from '../../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteSlugToSave,
} from '../../../lib/state/redux/slice-ui';
import React from 'react';
import { __ } from '@wordpress/i18n';

export function SitePersistButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: React.ReactNode;
	storage?: Extract<SiteStorageType, 'opfs' | 'local-fs'> | null;
}) {
	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, siteSlug)
	);
	const dispatch = useAppDispatch();

	if (!clientInfo?.opfsSync || clientInfo.opfsSync?.status === 'error') {
		const openSaveModal = () => {
			dispatch(setSiteSlugToSave(siteSlug));
			dispatch(setActiveModal(modalSlugs.SAVE_SITE));
		};
		const button = <div onClick={openSaveModal}>{children}</div>;

		return (
			<>
				{button}
				{clientInfo?.opfsSync?.status === 'error' && (
					<div className={css.error}>
						{__(
							'There has been an error. Please try again.',
							'playground-website'
						)}
					</div>
				)}
			</>
		);
	}

	return React.cloneElement(children as React.ReactElement, {
		className: css.inProgress,
		disabled: true,
		children: __('Saving...', 'playground-website'),
	});
}
