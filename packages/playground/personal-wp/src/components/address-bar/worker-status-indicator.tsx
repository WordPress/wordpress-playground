import {
	useAppSelector,
	getActiveClientInfo,
} from '../../lib/state/redux/store';
import { useTabTracking } from '../../lib/hooks/use-tab-tracking';
import css from './worker-status-indicator.module.css';

interface WorkerStatusIndicatorProps {
	onOpenOverlay?: () => void;
}

export function WorkerStatusIndicator({
	onOpenOverlay,
}: WorkerStatusIndicatorProps) {
	const clientInfo = useAppSelector(getActiveClientInfo);

	const hasOwnWorker = !!clientInfo && !clientInfo.isDependentMode;
	const { otherTabs, workerLost } = useTabTracking(hasOwnWorker);

	const otherTabCount = otherTabs.length;

	if (otherTabCount === 0 && !workerLost) {
		return null;
	}

	if (workerLost) {
		return (
			<div
				className={`${css.badge} ${css.workerLost}`}
				title="Worker connection lost. Click to reload."
				onClick={() => window.location.reload()}
			>
				<span className={css.reloadText}>Reload required</span>
				<svg
					className={css.reloadIcon}
					width="12"
					height="12"
					viewBox="0 0 16 16"
					fill="currentColor"
				>
					<path d="M13.65 2.35C12.2 0.9 10.21 0 8 0 3.58 0 0.01 3.58 0.01 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" />
				</svg>
			</div>
		);
	}

	return (
		<div
			className={css.badge}
			title={
				hasOwnWorker
					? `This tab has its own worker (${otherTabCount} other tab${otherTabCount === 1 ? '' : 's'})`
					: `This tab depends on another tab's worker (${otherTabCount} other tab${otherTabCount === 1 ? '' : 's'})`
			}
			onClick={onOpenOverlay}
			style={{ cursor: onOpenOverlay ? 'pointer' : 'default' }}
		>
			{hasOwnWorker ? 'Main' : 'Dependent'}
		</div>
	);
}
