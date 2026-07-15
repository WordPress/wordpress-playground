import classNames from 'classnames';
import { forwardRef, useId } from 'react';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { Icon, close } from '@wordpress/icons';
import css from './style.module.css';

export type DockPaneProps = {
	title: string;
	children: ReactNode;
	description?: string;
	headerSubtitle?: ReactNode;
	className?: string;
	style?: CSSProperties;
	isEditor?: boolean;
	isFixedHeight?: boolean;
	isCompact?: boolean;
	showHeader?: boolean;
	headerAction?: ReactNode;
	ariaLabel?: string;
	closeDisabled?: boolean;
	closeTitle?: string;
	onClose?: MouseEventHandler<HTMLButtonElement>;
};

/**
 * Shared shell for floating dock panes. It owns the dialog semantics, optional
 * mobile close control, common header, and body slot without choosing content.
 */
export const DockPane = forwardRef<HTMLElement, DockPaneProps>(
	function DockPane(
		{
			title,
			description,
			headerSubtitle,
			children,
			className,
			style,
			isEditor = false,
			isFixedHeight = false,
			isCompact = false,
			showHeader = true,
			headerAction,
			ariaLabel,
			closeDisabled = false,
			closeTitle,
			onClose,
		},
		ref
	) {
		const closeDescriptionId = useId();
		const closeDescription =
			closeTitle && closeTitle !== 'Close' ? closeTitle : undefined;

		return (
			<section
				ref={ref}
				className={classNames(
					css.pane,
					{
						[css.paneEditor]: isEditor,
						[css.paneFixedHeight]: isFixedHeight,
						[css.paneCompact]: isCompact,
					},
					className
				)}
				style={style}
				role="dialog"
				tabIndex={-1}
				aria-label={ariaLabel ?? `${title} pane`}
			>
				{onClose && (
					<>
						<button
							type="button"
							className={css.paneClose}
							aria-label="Close"
							aria-describedby={
								closeDescription
									? closeDescriptionId
									: undefined
							}
							title={closeTitle ?? 'Close'}
							disabled={closeDisabled}
							onClick={onClose}
						>
							<Icon icon={close} size={24} />
						</button>
						{closeDescription && (
							<span
								id={closeDescriptionId}
								className={css.visuallyHidden}
							>
								{closeDescription}
							</span>
						)}
					</>
				)}
				{showHeader && (
					<div className={css.paneHeader}>
						<div className={css.paneHeaderMain}>
							<h2>{title}</h2>
							{headerSubtitle !== undefined ? (
								<div className={css.paneDescription}>
									{headerSubtitle}
								</div>
							) : (
								description && (
									<p className={css.paneDescription}>
										{description}
									</p>
								)
							)}
						</div>
						{headerAction}
					</div>
				)}
				<div className={css.paneBody}>{children}</div>
			</section>
		);
	}
);
