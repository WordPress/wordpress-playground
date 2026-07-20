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
			{/* Error reports must show everything — a WASM crash is a
			    Playground entry, and hiding it would hide the crash itself. */}
			<SiteLogs
				key={activeModal}
				className={css.logsInsideModal}
				defaultShowPlayground
			/>
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

export function SiteLogs({
	className,
	defaultShowPlayground = false,
}: {
	className?: string;
	defaultShowPlayground?: boolean;
}) {
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [tierFilter, setTierFilter] = useState<LogTier | 'all'>('all');
	// Playground host messages are noise for most debugging sessions, so the
	// Dock pane hides them until the Playground chip turns them back on.
	const [showPlayground, setShowPlayground] = useState(defaultShowPlayground);
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
	}, [tierFilter, searchTerm, showPlayground]);

	const entries = useMemo(() => parseLogs(logs), [logs]);

	// Keep each entry's original append-only position as its stable React key.
	const searchedEntries = useMemo(() => {
		const needle = searchTerm.toLowerCase();
		return entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => entry.raw.toLowerCase().includes(needle));
	}, [entries, searchTerm]);

	const playgroundCount = useMemo(
		() =>
			searchedEntries.filter(
				({ entry }) => entry.channel === 'Playground'
			).length,
		[searchedEntries]
	);

	const channelEntries = useMemo(
		() =>
			showPlayground
				? searchedEntries
				: searchedEntries.filter(
						({ entry }) => entry.channel !== 'Playground'
					),
		[searchedEntries, showPlayground]
	);

	const tierCounts = useMemo(() => {
		const counts: Record<LogTier, number> = {
			error: 0,
			warning: 0,
			info: 0,
		};
		for (const { entry } of channelEntries) {
			counts[entry.tier]++;
		}
		return counts;
	}, [channelEntries]);

	const visibleEntries =
		tierFilter === 'all'
			? channelEntries
			: channelEntries.filter(({ entry }) => entry.tier === tierFilter);

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
		setShowPlayground(defaultShowPlayground);
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
						__nextHasNoMarginBottom
					/>
					<div
						className={css.logFilters}
						role="group"
						aria-label="Filter logs"
					>
						<button
							type="button"
							className={css.logFilterChip}
							aria-pressed={tierFilter === 'all'}
							onClick={() => setTierFilter('all')}
						>
							All
							<span className={css.logFilterCount}>
								{channelEntries.length}
							</span>
						</button>
						{/* The chip set is fixed: empty tiers dim instead of
						    disappearing, so the row never reshuffles. */}
						{TIER_FILTERS.map(({ tier, label }) => (
							<button
								key={tier}
								type="button"
								className={css.logFilterChip}
								aria-pressed={tierFilter === tier}
								disabled={
									tierCounts[tier] === 0 &&
									tierFilter !== tier
								}
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
						<span
							className={css.logFilterDivider}
							aria-hidden="true"
						/>
						<button
							type="button"
							className={css.logFilterChip}
							aria-pressed={showPlayground}
							disabled={playgroundCount === 0 && !showPlayground}
							title="Show runtime messages from the Playground app itself"
							onClick={() => setShowPlayground(!showPlayground)}
						>
							Playground
							<span className={css.logFilterCount}>
								{playgroundCount}
							</span>
						</button>
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
						{(searchTerm !== '' || tierFilter !== 'all') && (
							<button
								type="button"
								className={css.logClearSearch}
								onClick={clearFilters}
							>
								Clear filters
							</button>
						)}
						{!showPlayground && playgroundCount > 0 && (
							<button
								type="button"
								className={css.logClearSearch}
								onClick={() => setShowPlayground(true)}
							>
								Show {playgroundCount} Playground{' '}
								{playgroundCount === 1 ? 'entry' : 'entries'}
							</button>
						)}
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

/** One log record: a fixed severity/time rail beside a clamped message. */
function LogEntryRow({
	entry,
	searchTerm,
}: {
	entry: LogEntry;
	searchTerm: string;
}) {
	const [expanded, setExpanded] = useState(false);
	const [overflowing, setOverflowing] = useState(false);
	const entryRef = useRef<HTMLLIElement>(null);
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
	}, [entry.raw, expanded]);

	const lineCount = entry.raw.split('\n').length;
	const time =
		entry.timestamp?.match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? entry.timestamp;

	return (
		<li ref={entryRef} className={css.logEntry}>
			{/* Severity and time live in one fixed rail so every message
			    column aligns. PHP is the default context — only Playground
			    rows carry a channel tag. */}
			<div className={css.logEntryRail}>
				<span className={css.logSeverity} data-tier={entry.tier}>
					{entry.label}
				</span>
				{entry.timestamp && (
					<time className={css.logTimestamp} title={entry.timestamp}>
						{time}
					</time>
				)}
				{entry.channel === 'Playground' && (
					<span className={css.logChannelTag}>Playground</span>
				)}
			</div>
			<div className={css.logEntryBody}>
				<div
					ref={messageRef}
					className={css.logEntryMessage}
					data-clamped={!expanded || undefined}
				>
					{splitSearchHighlights(entry.raw, searchTerm).map(
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
						onClick={() => {
							const next = !expanded;
							setExpanded(next);
							if (!next) {
								// Collapsing shrinks the list; without this
								// the viewport lands on whatever slid up.
								requestAnimationFrame(() =>
									entryRef.current?.scrollIntoView({
										block: 'nearest',
									})
								);
							}
						}}
					>
						{expanded
							? 'Show less'
							: lineCount > CLAMP_LINES
								? `Show all ${lineCount} lines`
								: 'Show more'}
					</button>
				)}
			</div>
			<button
				type="button"
				className={css.logCopy}
				aria-label="Copy log entry"
				title="Copy log entry"
				onClick={() => copy(entry.raw)}
			>
				<Icon icon={copied ? check : copySmall} size={18} />
			</button>
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
