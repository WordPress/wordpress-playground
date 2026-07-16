import classNames from 'classnames';
import { forwardRef } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import css from './style.module.css';

export type DockItemButtonVariant = 'destination' | 'create';

export type DockItemButtonProps = {
	label: string;
	ariaLabel: string;
	icon: ReactNode;
	isActive?: boolean;
	variant?: DockItemButtonVariant;
	hasSeparator?: boolean;
	hasNotification?: boolean;
	notificationAriaSuffix?: string;
	disabled?: boolean;
	dataCy?: string;
	onClick?: MouseEventHandler<HTMLButtonElement>;
};

/**
 * A reusable two-line Dock control: icon above label, semantic product role,
 * optional group divider, and optional notification dot.
 */
export const DockItemButton = forwardRef<
	HTMLButtonElement,
	DockItemButtonProps
>(function DockItemButton(
	{
		label,
		ariaLabel,
		icon,
		isActive = false,
		variant = 'destination',
		hasSeparator = false,
		hasNotification = false,
		notificationAriaSuffix = 'notification available',
		disabled = false,
		dataCy,
		onClick,
	},
	ref
) {
	const buttonAriaLabel = hasNotification
		? `${ariaLabel} — ${notificationAriaSuffix}`
		: ariaLabel;

	return (
		<span
			className={classNames({
				[css.withSeparator]: hasSeparator,
			})}
		>
			<button
				type="button"
				ref={ref}
				className={classNames(css.dockItem, {
					[css.dockItemCreate]: variant === 'create',
					[css.dockItemActive]: isActive,
				})}
				aria-label={buttonAriaLabel}
				aria-pressed={isActive}
				disabled={disabled}
				onClick={onClick}
				data-cy={dataCy}
			>
				<span className={css.dockIcon} aria-hidden="true">
					{icon}
				</span>
				<span className={css.dockLabel}>{label}</span>
				{hasNotification && (
					<span className={css.dockItemDot} aria-hidden="true" />
				)}
			</button>
		</span>
	);
});
