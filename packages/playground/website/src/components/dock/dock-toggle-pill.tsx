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
	collapseButtonRef,
	onToggleCollapsed,
	onToggleFullWidth,
}: DockTogglePillProps) {
	return (
		<div className={css.dockTogglePill}>
			<button
				type="button"
				ref={collapseButtonRef}
				className={classNames(css.dockPillBtn, css.dockPillCollapse, {
					[css.dockPillCollapseClosed]: isCollapsed,
				})}
				aria-label={isCollapsed ? 'Show tools' : 'Hide tools'}
				aria-expanded={!isCollapsed}
				title={isCollapsed ? 'Show tools' : 'Hide tools'}
				onClick={onToggleCollapsed}
			>
				<DockCollapseChevronIcon />
			</button>
			<button
				type="button"
				className={css.dockPillBtn}
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
