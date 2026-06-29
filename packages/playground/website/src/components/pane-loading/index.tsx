import type { CSSProperties } from 'react';
import classNames from 'classnames';
import { Spinner } from '../spinner';
import css from './style.module.css';

/**
 * A calm, centered loading state for dock panes whose content isn't ready yet
 * (e.g. the WordPress runtime is still booting). Replaces a blank pane — which
 * reads as broken, especially full-screen on mobile — with a clear "loading"
 * message and a spinner.
 */
export function PaneLoading({ message }: { message: string }) {
	return (
		<div className={css.paneLoading} role="status" aria-live="polite">
			<Spinner size={28} />
			<p className={css.paneLoadingText}>{message}</p>
		</div>
	);
}

/**
 * A compact inline notice for panes whose actions are disabled while the
 * Playground boots (Database, Share). Sits above the disabled controls so it's
 * clear WHY they're inactive — they become available once the runtime is ready.
 *
 * It stays mounted and animates its own height/opacity collapse when `show`
 * flips to false, so the surrounding pane resizes smoothly instead of snapping
 * the moment the runtime connects. `gap` should match the flex gap of the
 * notice's parent so the collapse leaves no residual space (negative-margin
 * cancel) — default matches `var(--space-3)`.
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
				<div
					className={css.bootNotice}
					role="status"
					aria-live="polite"
				>
					<Spinner size={16} />
					<span className={css.bootNoticeText}>{message}</span>
				</div>
			</div>
		</div>
	);
}
