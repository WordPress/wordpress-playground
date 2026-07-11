import classNames from 'classnames';
import { forwardRef } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import css from './style.module.css';

export type DockItemButtonProps = {
	label: string;
	ariaLabel: string;
	icon: ReactNode;
	isActive?: boolean;
	isPrimary?: boolean;
	hasSeparator?: boolean;
	hasNotification?: boolean;
	notificationAriaSuffix?: string;
	dataCy?: string;
	onClick?: MouseEventHandler<HTMLButtonElement>;
};

/**
 * A reusable two-line dock tool button: icon above label, optional primary
 * treatment, optional group divider, and optional notification dot.
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
		isPrimary = false,
		hasSeparator = false,
		hasNotification = false,
		notificationAriaSuffix = 'notification available',
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
					[css.dockItemPrimary]: isPrimary,
					[css.dockItemActive]: isActive,
				})}
				aria-label={buttonAriaLabel}
				aria-pressed={isActive}
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
