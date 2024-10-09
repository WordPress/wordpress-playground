import { Icon } from '@wordpress/components';
import { ClockIcon, folder, layout } from '@wp-playground/components';
import css from './style.module.css';
import { SiteStorageType } from '../../../lib/site-metadata';

export function StorageType({ type }: { type: SiteStorageType }) {
	switch (type) {
		case 'local-fs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={folder} />
					<span>Local</span>
				</div>
			);
		case 'opfs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={layout} />
					<span>Browser</span>
				</div>
			);
		case 'none':
			return (
				<div className={css.storageType}>
					<ClockIcon />
					<span>Temporary</span>
				</div>
			);
	}
}
