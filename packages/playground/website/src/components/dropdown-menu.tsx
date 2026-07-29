import { DropdownMenu as WordPressDropdownMenu } from '@wordpress/components';
import type { ComponentProps } from 'react';

type DropdownMenuProps = ComponentProps<typeof WordPressDropdownMenu>;

export function DropdownMenu({
	menuProps,
	...dropdownMenuProps
}: DropdownMenuProps) {
	const onKeyDown = menuProps?.onKeyDown;

	return (
		<WordPressDropdownMenu
			{...dropdownMenuProps}
			menuProps={{
				...menuProps,
				onKeyDown: (event) => {
					onKeyDown?.(event);
					if (!event.defaultPrevented) {
						focusMenuBoundary(event);
					}
				},
			}}
		/>
	);
}

/**
 * Handles Home and End for the current menu without moving focus into a
 * nested menu.
 */
function focusMenuBoundary(event: KeyboardEvent) {
	if (event.key !== 'Home' && event.key !== 'End') {
		return;
	}

	// WordPress components wrap arrow navigation, but do not handle these
	// boundary keys. Supply them once for every Playground dropdown menu.
	const menu = event.currentTarget as HTMLElement;
	const menuItems = Array.from(
		menu.querySelectorAll<HTMLElement>(
			'[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
		)
	).filter((item) => item.closest('[role="menu"]') === menu);
	const target =
		event.key === 'Home' ? menuItems[0] : menuItems[menuItems.length - 1];

	if (target) {
		event.preventDefault();
		target.focus();
	}
}
