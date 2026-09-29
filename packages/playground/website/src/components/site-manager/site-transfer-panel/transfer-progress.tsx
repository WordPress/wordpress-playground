import { formatBytes } from '@php-wasm/util';
import type { TransferProgress } from '../../../lib/reprint/reprint';
import { InlineProgress } from '../../pane-loading';
import css from './style.module.css';

export function TransferProgressView({
	progress,
}: {
	progress: TransferProgress;
}) {
	const total = progress.bytesTotal || progress.filesTotal;
	const done = progress.bytesTotal ? progress.bytesDone : progress.filesDone;
	if (progress.overallPercent === undefined && (!total || done === undefined))
		return <InlineProgress message={progress.message} />;
	const percent = Math.min(
		100,
		Math.max(0, progress.overallPercent ?? (done! / total!) * 100)
	);
	return (
		<div className={css.transferProgress}>
			<div className={css.progressHeading}>
				<strong>{progress.message}</strong>
				<span>{Math.floor(percent)}%</span>
			</div>
			<progress aria-label={progress.message} max={100} value={percent} />
			{(progress.detail ||
				progress.bytesDone !== undefined ||
				(progress.filesDone !== undefined &&
					progress.filesTotal !== undefined)) && (
				<div className={css.progressDetails}>
					{progress.detail && <span>{progress.detail}</span>}
					{progress.bytesDone !== undefined && (
						<span>
							{formatBytes(progress.bytesDone)}
							{!!progress.bytesTotal &&
								` / ${formatBytes(progress.bytesTotal)}`}
						</span>
					)}
					{progress.filesDone !== undefined &&
						progress.filesTotal !== undefined && (
							<span>
								{progress.filesDone.toLocaleString()} /{' '}
								{progress.filesTotal.toLocaleString()} files
							</span>
						)}
				</div>
			)}
		</div>
	);
}
