import type { CSSProperties } from 'react';
import classNames from 'classnames';
import { Spinner } from '../spinner';
import css from './style.module.css';

/**
 * A calm, centered loading state for dock panes whose content isn't ready yet.
 * It replaces a blank pane, which can read as broken on full-screen mobile UI.
 */
export function PaneLoading({ message }: { message: string }) {
	return (
		<div className={css.paneLoading} role="status" aria-live="polite">
			<Spinner size={32} />
			<p className={css.paneLoadingText}>{message}</p>
		</div>
	);
}

/**
 * A compact inline notice for panes whose actions are disabled while the
 * Playground boots. It stays mounted so the surrounding pane can collapse the
 * notice smoothly when `show` flips to false.
 */
export function PlaygroundBootNotice({
	show,
	className,
	message = 'The Playground is still loading — these tools will be ready in a moment.',
	gap = 'var(--space-3)',
}: {
	show: boolean;
	className?: string;
	message?: string;
	gap?: string;
}) {
	return (
		<div
			className={classNames(css.bootNoticeCollapsible, className, {
				[css.isHidden]: !show,
			})}
			style={{ '--boot-gap': gap } as CSSProperties}
			aria-hidden={!show || undefined}
		>
			<div className={css.bootNoticeInner}>
				<InlineProgress message={message} />
			</div>
		</div>
	);
}

/**
 * Displays progress without replacing the surrounding pane.
 *
 * The message and spinner are presented in the shared compact progress
 * container. The container is also a polite live region so assistive
 * technology announces message changes without interrupting the user.
 *
 * This component only renders the progress state. Its parent owns the
 * operation lifecycle and decides when to mount or remove it. Use
 * `PaneLoading` instead when the entire pane is unavailable.
 *
 * @param message Human-readable description of the operation in progress.
 * @returns The compact progress status region.
 */
export function InlineProgress({ message }: { message: string }) {
	return (
		<div className={css.inlineProgress} role="status" aria-live="polite">
			<Spinner size={16} />
			<span className={css.inlineProgressText}>{message}</span>
		</div>
	);
}
