import classNames from 'classnames';
import type { MouseEventHandler, PointerEventHandler, ReactNode } from 'react';
import css from './style.module.css';

export type DockCornerSide = 'left' | 'right';

export type DockCornerLauncherProps = {
	side: DockCornerSide;
	children: ReactNode;
	isDragging?: boolean;
	isFolding?: boolean;
	ariaLabel?: string;
	title?: string;
	onClick?: MouseEventHandler<HTMLButtonElement>;
	onPointerDown?: PointerEventHandler<HTMLButtonElement>;
	onPointerMove?: PointerEventHandler<HTMLButtonElement>;
	onPointerUp?: PointerEventHandler<HTMLButtonElement>;
	onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
};

/**
 * The minimized dock launcher. It can stay mounted through fold/unfold gestures
 * while the full dock animates into or out of a bottom corner.
 */
export function DockCornerLauncher({
	side,
	children,
	isDragging = false,
	isFolding = false,
	ariaLabel = 'Show Playground tools',
	title = 'Drag out or click to show Playground tools',
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
}: DockCornerLauncherProps) {
	return (
		<button
			type="button"
			className={classNames(css.dockCorner, {
				[css.dockCornerLeft]: side === 'left',
				[css.dockCornerRight]: side === 'right',
				[css.dockCornerDragging]: isDragging,
			})}
			aria-label={ariaLabel}
			title={title}
			disabled={isFolding}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onClick={onClick}
		>
			<span className={css.dockCornerLogo} aria-hidden="true">
				{children}
			</span>
		</button>
	);
}
