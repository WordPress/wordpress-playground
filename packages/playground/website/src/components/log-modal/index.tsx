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
		<Modal title={props.title || 'PHP error log'} onRequestClose={onClose}>
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
								{searchedEntries.length}
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
					</div>
				) : (
					<div className={css.logEmptyState}>
						<p className={css.logEmptyTitle}>Nothing logged yet</p>
						<p className={css.logEmptyHint}>
							PHP errors, warnings, and notices from your site
							appear here as they are written to the debug log.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

/** One log record: its timestamp above a full-width, clamped message. */
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
	}, [entry.message, expanded]);

	const lineCount = entry.message.split('\n').length;

	return (
		<li ref={entryRef} className={css.logEntry}>
			{entry.timestamp && (
				<time className={css.logTimestamp}>{entry.timestamp}</time>
			)}
			<div className={css.logEntryBody}>
				<div
					ref={messageRef}
					className={css.logEntryMessage}
					data-clamped={!expanded || undefined}
				>
					{headSegments(entry, searchTerm).map(
						(segment, segmentIndex) => {
							const text = segment.highlight ? (
								<mark>{segment.text}</mark>
							) : (
								segment.text
							);
							// The severity head stays part of the message; it
							// is only tinted, never restated elsewhere.
							return segment.head ? (
								<span
									key={segmentIndex}
									className={css.logSeverityHead}
									data-tier={entry.tier}
								>
									{text}
								</span>
							) : (
								<Fragment key={segmentIndex}>{text}</Fragment>
							);
						}
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

/**
 * Search-highlight segments split once more at the severity-head boundary,
 * so the head keeps its tint even when a search match crosses from the
 * head into the message.
 */
function headSegments(
	entry: LogEntry,
	searchTerm: string
): Array<{ text: string; highlight: boolean; head: boolean }> {
	const segments = splitSearchHighlights(entry.message, searchTerm);
	const pieces: Array<{ text: string; highlight: boolean; head: boolean }> =
		[];
	let offset = 0;
	for (const segment of segments) {
		const end = offset + segment.text.length;
		if (offset < entry.headLength && end > entry.headLength) {
			const cut = entry.headLength - offset;
			pieces.push({
				text: segment.text.slice(0, cut),
				highlight: segment.highlight,
				head: true,
			});
			pieces.push({
				text: segment.text.slice(cut),
				highlight: segment.highlight,
				head: false,
			});
		} else {
			pieces.push({
				text: segment.text,
				highlight: segment.highlight,
				head: end <= entry.headLength,
			});
		}
		offset = end;
	}
	return pieces;
}

/** Copies text and reports a short-lived "copied" flag for button feedback. */
function useCopyToClipboard(): [boolean, (text: string) => void] {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number>();
	useEffect(() => () => window.clearTimeout(timerRef.current), []);
	const copy = (text: string) => {
		void navigator.clipboard?.writeText(text).then(
			() => {
				setCopied(true);
				window.clearTimeout(timerRef.current);
				timerRef.current = window.setTimeout(
					() => setCopied(false),
					1600
				);
			},
			() => {}
		);
	};
	return [copied, copy];
}
