import { Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ClockIcon, folder, layout } from '@wp-playground/components';
import css from './style.module.css';
import type { SiteStorageType } from '../../../lib/state/redux/slice-sites';

export function StorageType({ type }: { type: SiteStorageType }) {
	switch (type) {
		case 'local-fs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={folder} />
					<span>{__('Local', 'playground-website')}</span>
				</div>
			);
		case 'opfs':
			return (
				<div className={css.storageType}>
					<Icon size={16} icon={layout} />
					<span>{__('Browser', 'playground-website')}</span>
				</div>
			);
		case 'none':
			return (
				<div className={css.storageType}>
					<ClockIcon />
					<span>{__('Temporary', 'playground-website')}</span>
				</div>
			);
	}
}
