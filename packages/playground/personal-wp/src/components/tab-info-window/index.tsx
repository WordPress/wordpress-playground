import { useState, useEffect } from 'react';
import {
	useAppSelector,
	getActiveClientInfo,
} from '../../lib/state/redux/store';
import { useTabTracking } from '../../lib/hooks/use-tab-tracking';
import css from './style.module.css';

function formatLoadTime(timestamp: number): string {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSeconds = Math.floor(diffMs / 1000);

	if (diffSeconds < 60) {
		return `${diffSeconds} secs ago`;
	} else if (diffSeconds < 3600) {
		const diffMinutes = Math.floor(diffSeconds / 60);
		return `${diffMinutes} mins ago`;
	} else if (diffSeconds < 86400) {
		const diffHours = Math.floor(diffSeconds / 3600);
		return `${diffHours} hrs ago`;
	} else {
		const diffDays = Math.floor(diffSeconds / 86400);
		return `${diffDays} days ago`;
	}
}

export function TabInfoWindow() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const [loadTime, setLoadTime] = useState<Date | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const [, setTick] = useState(0);

	const hasOwnWorker = !!clientInfo && !clientInfo.isDependentMode;
	const { tabInfo, otherTabs } = useTabTracking(hasOwnWorker);

	useEffect(() => {
		if (tabInfo) {
			setLoadTime(new Date(tabInfo.createdAt));
		}
	}, [tabInfo]);

	useEffect(() => {
		const interval = setInterval(() => {
			setTick((t) => t + 1);
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	if (!tabInfo || !loadTime) {
		return null;
	}

	const sortedOtherTabs = [...otherTabs].sort(
		(a, b) => b.createdAt - a.createdAt
	);

	const oldestTabId =
		sortedOtherTabs.length > 0
			? sortedOtherTabs[sortedOtherTabs.length - 1].tabId
			: null;

	const workerTabId = hasOwnWorker ? tabInfo.tabId : oldestTabId;

	return (
		<div className={css.tabInfoWindow}>
			<div className={css.infoRow}>
				<span className={css.label}>WordPress loaded:</span>
				<span
					className={css.timeValue}
					title={loadTime.toLocaleString()}
				>
					{formatLoadTime(tabInfo.createdAt)}
				</span>
			</div>
			{otherTabs.length > 0 && (
				<>
					<div className={css.accordionSection}>
						<div
							className={`${css.infoRow} ${css.clickable}`}
							onClick={() => setIsExpanded(!isExpanded)}
						>
							<span className={css.label}>Other tabs:</span>
							<span className={css.value}>
								{otherTabs.length}
								<span className={css.expandIcon}>
									{isExpanded ? ' ▼' : ' ▶'}
								</span>
							</span>
						</div>
						{isExpanded && (
							<div className={css.tabList}>
								{sortedOtherTabs.map((tab) => {
									const isWorkerTab =
										tab.tabId === workerTabId;
									return (
										<div
											key={tab.tabId}
											className={css.tabItem}
										>
											<span
												className={css.tabTime}
												title={new Date(
													tab.createdAt
												).toLocaleString()}
											>
												{formatLoadTime(tab.createdAt)}
											</span>
											{isWorkerTab && (
												<span
													className={css.workerBadge}
													title="This tab has the active worker"
												>
													Worker
												</span>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
					<div
						className={css.infoRow}
						title={
							hasOwnWorker
								? 'This tab has its own PHP worker'
								: 'This tab is reusing a worker from another tab (dependent mode)'
						}
					>
						<span className={css.label}>Worker:</span>
						<span className={css.value}>
							{hasOwnWorker ? 'Own' : 'Shared'}
						</span>
					</div>
				</>
			)}
		</div>
	);
}
