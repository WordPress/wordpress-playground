import { SiteStorageType } from '../../../lib/site-storage';
import { Icon } from '@wordpress/components';
import { clock, folder, layout } from '../../../../../components/src/icons';
import css from './style.module.css';

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
		case 'temporary':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={clock} />
					<span>Temporary</span>
				</div>
			);
	}
}
