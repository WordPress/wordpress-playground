import { MenuItem } from '@wordpress/components';
import classNames from 'classnames';
import type { ComponentPropsWithoutRef } from 'react';
import css from './menu-item-with-description.module.css';

type MenuItemWithDescriptionProps = ComponentPropsWithoutRef<typeof MenuItem>;

export function MenuItemWithDescription({
	className,
	info,
	...props
}: MenuItemWithDescriptionProps) {
	return (
		<MenuItem
			{...props}
			className={classNames(className, info && css.withDescription)}
			info={info}
		/>
	);
}
