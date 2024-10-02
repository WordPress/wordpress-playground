import { Icon } from '@wordpress/components';
import { ClockIcon, FolderIcon, LayoutIcon } from '../icons';
import css from './style.module.css';
import { SiteStorageType } from '../../../lib/site-metadata';

export function StorageType({ type }: { type: SiteStorageType }) {
	switch (type) {
		case 'local-fs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={FolderIcon} />
					<span>Local</span>
				</div>
			);
		case 'opfs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={LayoutIcon} />
					<span>Browser</span>
				</div>
			);
		case 'opfs-temporary':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={ClockIcon} />
					<span>Temporary</span>
				</div>
			);
	}
}
