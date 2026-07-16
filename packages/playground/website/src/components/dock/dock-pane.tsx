import classNames from 'classnames';
import { forwardRef, useEffect, useId } from 'react';
import type {
	CSSProperties,
	MouseEventHandler,
	ReactNode,
	RefObject,
} from 'react';
import { Icon, chevronLeft, close } from '@wordpress/icons';
import css from './style.module.css';

export type DockPaneHeaderOverride = {
	title: string;
	description?: string;
	backLabel: string;
	backButtonRef?: RefObject<HTMLButtonElement>;
	focusBackButton?: boolean;
	onBack: MouseEventHandler<HTMLButtonElement>;
};

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
	headerOverride?: DockPaneHeaderOverride;
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
			headerOverride,
			ariaLabel,
			closeDisabled = false,
			closeTitle,
			onClose,
		},
		ref
	) {
		const closeDescriptionId = useId();
		const displayedTitle = headerOverride?.title ?? title;
		const displayedDescription = headerOverride
			? headerOverride.description
			: description;
		const closeDescription =
			closeTitle && closeTitle !== 'Close' ? closeTitle : undefined;

		useEffect(() => {
			if (headerOverride?.focusBackButton) {
				headerOverride.backButtonRef?.current?.focus();
			}
		}, [headerOverride]);

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
				aria-label={ariaLabel ?? `${displayedTitle} pane`}
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
						{headerOverride && (
							<button
								ref={headerOverride.backButtonRef}
								type="button"
								className={css.paneBack}
								aria-label={headerOverride.backLabel}
								onClick={headerOverride.onBack}
							>
								<Icon icon={chevronLeft} size={20} />
							</button>
						)}
						<div className={css.paneHeaderMain}>
							<h2>{displayedTitle}</h2>
							{!headerOverride && headerSubtitle !== undefined ? (
								<div className={css.paneDescription}>
									{headerSubtitle}
								</div>
							) : (
								displayedDescription && (
									<p className={css.paneDescription}>
										{displayedDescription}
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
