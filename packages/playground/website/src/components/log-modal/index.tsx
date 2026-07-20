import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { logEventType, logger } from '@php-wasm/logger';

import classNames from 'classnames';
import css from './style.module.css';
import { Modal } from '../modal';
import { Icon, TextControl } from '@wordpress/components';
import { check, copySmall } from '@wordpress/icons';
import type {
	PlaygroundDispatch,
	PlaygroundReduxState,
} from '../../lib/state/redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { splitSearchHighlights } from './log-highlights';
import { parseLogs } from './log-parsing';
import type { LogEntry, LogTier } from './log-parsing';

export function LogModal(props: { description?: JSX.Element; title?: string }) {
	const activeModal = useSelector(
		(state: PlaygroundReduxState) => state.ui.activeModal
	);
	const dispatch: PlaygroundDispatch = useDispatch();

	function onClose() {
		dispatch(setActiveModal(null));
	}

	return (
		<Modal title={props.title || 'Error Logs'} onRequestClose={onClose}>
			<div>{props.description}</div>
			<SiteLogs key={activeModal} className={css.logsInsideModal} />
		</Modal>
	);
}

/** Keep in sync with `-webkit-line-clamp` in style.module.css. */
const CLAMP_LINES = 6;

const TIER_FILTERS: Array<{ tier: LogTier; label: string }> = [
	{ tier: 'error', label: 'Errors' },
	{ tier: 'warning', label: 'Warnings' },
	{ tier: 'info', label: 'Info' },
];

export function SiteLogs({ className }: { className?: string }) {
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [tierFilter, setTierFilter] = useState<LogTier | 'all'>('all');
	const [copiedAll, copyAll] = useCopyToClipboard();
	const contentRef = useRef<HTMLDivElement>(null);

	// A deep scroll offset makes no sense against a different result set —
	// jump back to the newest entries whenever the filter or search changes.
	useEffect(() => {
		for (
			let node = contentRef.current?.parentElement;
			node;
			node = node.parentElement
		) {
			if (node.scrollTop > 0) {
				node.scrollTop = 0;
			}
		}
	}, [tierFilter, searchTerm]);

	const entries = useMemo(() => parseLogs(logs), [logs]);

	// Keep each entry's original append-only position as its stable React key.
	const searchedEntries = useMemo(() => {
		const needle = searchTerm.toLowerCase();
		return entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => entry.raw.toLowerCase().includes(needle));
	}, [entries, searchTerm]);

	const tierCounts = useMemo(() => {
		const counts: Record<LogTier, number> = {
			error: 0,
			warning: 0,
			info: 0,
		};
		for (const { entry } of searchedEntries) {
			counts[entry.tier]++;
		}
		return counts;
	}, [searchedEntries]);

	const visibleEntries =
		tierFilter === 'all'
			? searchedEntries
			: searchedEntries.filter(({ entry }) => entry.tier === tierFilter);

	useEffect(() => {
		getLogs();
		logger.addEventListener(logEventType, getLogs);
		return () => {
			logger.removeEventListener(logEventType, getLogs);
		};
	}, []);

	function getLogs() {
		// TODO: Fix log querying/listing to be per site
		setLogs(logger.getLogs());
	}

	function clearFilters() {
		setSearchTerm('');
		setTierFilter('all');
	}

	return (
		<div className={classNames(css.logsComponent, className)}>
			{logs.length > 0 ? (
				<div className={css.logToolbar}>
					<TextControl
						aria-label="Search"
						placeholder="Search logs"
						value={searchTerm}
						onChange={setSearchTerm}
						autoFocus={true}
					/>
					<div
						className={css.logFilters}
						role="group"
						aria-label="Filter logs by severity"
					>
						<button
							type="button"
							className={css.logFilterChip}
							aria-pressed={tierFilter === 'all'}
							onClick={() => setTierFilter('all')}
						>
							All
							<span className={css.logFilterCount}>
								{searchedEntries.length}
							</span>
						</button>
						{TIER_FILTERS.filter(
							({ tier }) =>
								tierCounts[tier] > 0 || tierFilter === tier
						).map(({ tier, label }) => (
							<button
								key={tier}
								type="button"
								className={css.logFilterChip}
								aria-pressed={tierFilter === tier}
								onClick={() =>
									setTierFilter(
										tierFilter === tier ? 'all' : tier
									)
								}
							>
								{label}
								<span className={css.logFilterCount}>
									{tierCounts[tier]}
								</span>
							</button>
						))}
						{visibleEntries.length > 0 && (
							<button
								type="button"
								className={css.logCopyAll}
								onClick={() =>
									copyAll(
										visibleEntries
											.map(({ entry }) => entry.raw)
											.join('\n')
									)
								}
							>
								{copiedAll ? 'Copied' : 'Copy logs'}
							</button>
						)}
					</div>
				</div>
			) : null}
			<div ref={contentRef} className={css.logContentContainer}>
				{visibleEntries.length > 0 ? (
					<ul className={css.logList}>
						{visibleEntries
							.slice()
							.reverse()
							.map(({ entry, index }) => (
								<LogEntryRow
									key={index}
									entry={entry}
									searchTerm={searchTerm}
								/>
							))}
					</ul>
				) : logs.length > 0 ? (
					<div className={css.logEmptyPlaceholder}>
						<p className={css.logEmptyHint}>
							{searchTerm
								? `No logs match “${searchTerm}”.`
								: 'No logs match the current filter.'}
						</p>
						<button
							type="button"
							className={css.logClearSearch}
							onClick={clearFilters}
						>
							Clear filters
						</button>
					</div>
				) : (
					<div className={css.logEmptyState}>
						<p className={css.logEmptyTitle}>Nothing logged yet</p>
						<p className={css.logEmptyHint}>
							This is the combined log for your Playground. Two
							kinds of messages land here as you use it:
						</p>
						<ul className={css.logLegend}>
							<li>
								<span className={css.logLegendTerm}>PHP</span>
								<span className={css.logLegendDesc}>
									errors, warnings, and notices from your
									site, and anything written to the debug log
									when WP_DEBUG is on
								</span>
							</li>
							<li>
								<span className={css.logLegendTerm}>
									Playground
								</span>
								<span className={css.logLegendDesc}>
									runtime messages from the Playground app
									itself
								</span>
							</li>
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

/** One log record: severity, source, and time above a clamped message body. */
function LogEntryRow({
	entry,
	searchTerm,
}: {
	entry: LogEntry;
	searchTerm: string;
}) {
	const [expanded, setExpanded] = useState(false);
	const [overflowing, setOverflowing] = useState(false);
	const messageRef = useRef<HTMLDivElement>(null);
	const [copied, copy] = useCopyToClipboard();

	// Collapsed entries clamp to a few lines. Only entries that actually
	// overflow that clamp — measured at the live pane width — get the toggle.
	useLayoutEffect(() => {
		const message = messageRef.current;
		if (!message || expanded) {
			return;
		}
		const measure = () =>
			setOverflowing(message.scrollHeight > message.clientHeight + 1);
		measure();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(message);
		return () => observer.disconnect();
	}, [entry.message, expanded]);

	const lineCount = entry.message.split('\n').length;
	const time =
		entry.timestamp?.match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? entry.timestamp;

	return (
		<li className={css.logEntry}>
			<div className={css.logEntryMeta}>
				<span className={css.logBadge} data-tier={entry.tier}>
					{entry.label}
				</span>
				<span className={css.logChannel}>{entry.channel}</span>
				{entry.timestamp && (
					<time className={css.logTimestamp} title={entry.timestamp}>
						{time}
					</time>
				)}
				<button
					type="button"
					className={css.logCopy}
					aria-label="Copy log entry"
					title="Copy log entry"
					onClick={() => copy(entry.raw)}
				>
					<Icon icon={copied ? check : copySmall} size={18} />
				</button>
			</div>
			<div
				ref={messageRef}
				className={css.logEntryMessage}
				data-clamped={!expanded || undefined}
			>
				{splitSearchHighlights(entry.message, searchTerm).map(
					(segment, segmentIndex) =>
						segment.highlight ? (
							<mark key={segmentIndex}>{segment.text}</mark>
						) : (
							<Fragment key={segmentIndex}>
								{segment.text}
							</Fragment>
						)
				)}
			</div>
			{(overflowing || expanded) && (
				<button
					type="button"
					className={css.logEntryToggle}
					aria-expanded={expanded}
					onClick={() => setExpanded(!expanded)}
				>
					{expanded
						? 'Show less'
						: lineCount > CLAMP_LINES
							? `Show all ${lineCount} lines`
							: 'Show more'}
				</button>
			)}
		</li>
	);
}

/** Copies text and reports a short-lived "copied" flag for button feedback. */
function useCopyToClipboard(): [boolean, (text: string) => void] {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number>();
	useEffect(() => () => window.clearTimeout(timerRef.current), []);
	const copy = (text: string) => {
		void navigator.clipboard?.writeText(text);
		setCopied(true);
		window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => setCopied(false), 1600);
	};
	return [copied, copy];
}
