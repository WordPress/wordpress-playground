import { formatBytes } from '@php-wasm/util';
import type { TransferProgress } from '../../../lib/reprint/reprint';
import css from './style.module.css';

/**
 * One fixed-height block for every phase of a transfer: the percentage, the
 * phase name, a bar, and separate rows for counters and context. Phases without
 * some of that data leave the slot empty rather than dropping it, so the pane
 * does not resize as the pull moves along.
 */
export function TransferProgressView({
	progress,
}: {
	progress: TransferProgress;
}) {
	const total = progress.bytesTotal || progress.filesTotal;
	const done = progress.bytesTotal ? progress.bytesDone : progress.filesDone;
	const raw =
		progress.overallPercent ??
		(total && done !== undefined ? (done / total) * 100 : undefined);
	const percent =
		raw === undefined ? undefined : Math.min(100, Math.max(0, raw));
	const bytes =
		progress.bytesDone !== undefined
			? formatBytes(progress.bytesDone) +
				(progress.bytesTotal
					? ` / ${formatBytes(progress.bytesTotal)}`
					: '')
			: undefined;
	const files =
		progress.filesDone !== undefined && progress.filesTotal !== undefined
			? `${progress.filesDone.toLocaleString()} / ${progress.filesTotal.toLocaleString()} files`
			: undefined;
	// Reprint can repeat the phase announcement as commentary between byte updates.
	const detail =
		progress.detail?.replace(/[.…]+$/, '') ===
		progress.message.replace(/[.…]+$/, '')
			? undefined
			: progress.detail;
	return (
		<div className={css.transferProgress} role="status" aria-live="polite">
			<div className={css.progressHeading}>
				<span className={css.progressPercent}>
					{percent === undefined ? '' : `${Math.floor(percent)}%`}
				</span>
				<span className={css.progressMessage}>{progress.message}</span>
			</div>
			<progress
				aria-label={progress.message}
				max={100}
				{...(percent === undefined ? {} : { value: percent })}
			/>
			<div className={css.progressDetails}>
				<span>{bytes}</span>
				<span>{files}</span>
				<span className={css.progressContext} title={detail}>
					{detail}
				</span>
			</div>
		</div>
	);
}
