import type { MouseEventHandler, Ref } from 'react';
import classNames from 'classnames';
import {
	DockCollapseChevronIcon,
	DockFloatingIcon,
	DockFullWidthIcon,
} from './icons';
import css from './style.module.css';

export type DockTogglePillProps = {
	isCollapsed: boolean;
	isFullWidth: boolean;
	collapseDisabled?: boolean;
	collapseButtonRef?: Ref<HTMLButtonElement>;
	onToggleCollapsed: MouseEventHandler<HTMLButtonElement>;
	onToggleFullWidth: MouseEventHandler<HTMLButtonElement>;
};

/**
 * Two switches fused into one split capsule: hide/show tools on the left,
 * floating/full-width mode on the right.
 */
export function DockTogglePill({
	isCollapsed,
	isFullWidth,
	collapseDisabled = false,
	collapseButtonRef,
	onToggleCollapsed,
	onToggleFullWidth,
}: DockTogglePillProps) {
	const collapseButtonLabel = collapseDisabled
		? 'Tools cannot be hidden right now'
		: isCollapsed
			? 'Show tools'
			: 'Hide tools';

	return (
		<div className={css.dockTogglePill}>
			<button
				type="button"
				ref={collapseButtonRef}
				className={classNames(css.dockPillBtn, css.dockPillCollapse, {
					[css.dockPillCollapseClosed]: isCollapsed,
				})}
				aria-label={collapseButtonLabel}
				aria-expanded={!isCollapsed}
				title={collapseButtonLabel}
				disabled={collapseDisabled}
				onClick={onToggleCollapsed}
			>
				<DockCollapseChevronIcon />
			</button>
			<button
				type="button"
				className={classNames(css.dockPillBtn, css.dockPillFullWidth)}
				aria-label={isFullWidth ? 'Exit full width' : 'Full width'}
				aria-pressed={isFullWidth}
				title={isFullWidth ? 'Exit full width' : 'Full width'}
				onClick={onToggleFullWidth}
			>
				{isFullWidth ? <DockFloatingIcon /> : <DockFullWidthIcon />}
			</button>
		</div>
	);
}
