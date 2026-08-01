import classNames from 'classnames';
import {
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useId,
	useState,
} from 'react';
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

const DockPaneEditorHeaderSlotContext = createContext<HTMLElement | null>(null);

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
		const [editorHeaderSlot, setEditorHeaderSlot] =
			useState<HTMLDivElement | null>(null);
		const displayedTitle = headerOverride?.title ?? title;
		const displayedDescription = headerOverride
			? headerOverride.description
			: description;
		const closeDescription =
			closeTitle && closeTitle !== 'Close' ? closeTitle : undefined;
		const closeButton = onClose ? (
			<button
				type="button"
				className={css.paneClose}
				aria-label="Close"
				aria-describedby={
					closeDescription ? closeDescriptionId : undefined
				}
				title={closeTitle ?? 'Close'}
				disabled={closeDisabled}
				onClick={onClose}
			>
				<Icon icon={close} size={24} />
			</button>
		) : null;

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
				{closeButton && closeDescription && (
					<span
						id={closeDescriptionId}
						className={css.visuallyHidden}
					>
						{closeDescription}
					</span>
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
							<div className={css.paneTitleRow}>
								<h2>{displayedTitle}</h2>
								{closeButton}
							</div>
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
				{!showHeader && closeButton && (
					<div className={css.paneEditorHeader}>
						<h2>{displayedTitle}</h2>
						<div
							ref={setEditorHeaderSlot}
							className={css.paneEditorHeaderSlot}
						/>
						{closeButton}
					</div>
				)}
				<DockPaneEditorHeaderSlotContext.Provider
					value={editorHeaderSlot}
				>
					<div className={css.paneBody}>{children}</div>
				</DockPaneEditorHeaderSlotContext.Provider>
			</section>
		);
	}
);

/** Returns the mobile title-row slot exposed by editor Dock panes. */
export function useDockPaneEditorHeaderSlot() {
	return useContext(DockPaneEditorHeaderSlotContext);
}
