import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import css from './style.module.css';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteStorageType } from '../../../lib/state/redux/slice-sites';
import { setActiveModal } from '../../../lib/state/redux/slice-ui';
import { modalSlugs } from '../../layout';

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
		const handleClick = () => {
			dispatch(setActiveModal(modalSlugs.SAVE_SITE));
		};
		const button = <div onClick={handleClick}>{children}</div>;

		return (
			<>
				{button}
				{clientInfo?.opfsSync?.status === 'error' && (
					<div className={css.error}>
						There has been an error. Please try again.
					</div>
				)}
			</>
		);
	}

	if (
		clientInfo?.opfsSync?.status === 'syncing' &&
		!clientInfo?.opfsSync?.progress
	) {
		return (
			<div className={css.progressInfo}>
				<div>
					<progress id="file" max="100" value="0"></progress>
				</div>
				<div>Preparing to save...</div>
			</div>
		);
	}

	return (
		<div className={css.progressInfo}>
			<div>
				<progress
					id="file"
					max={clientInfo.opfsSync.progress?.total}
					value={clientInfo.opfsSync.progress?.files}
				></progress>
			</div>
			<div>
				{clientInfo.opfsSync.progress?.files}
				{' / '}
				{clientInfo.opfsSync.progress?.total} files saved
			</div>
		</div>
	);
}
