import { Fragment, useEffect, useState } from 'react';
import { logEventType, logger } from '@php-wasm/logger';

import classNames from 'classnames';
import css from './style.module.css';
import { Modal } from '../modal';
import { TextControl } from '@wordpress/components';
import type {
	PlaygroundDispatch,
	PlaygroundReduxState,
} from '../../lib/state/redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveModal } from '../../lib/state/redux/slice-ui';
import { splitLogHighlights } from './log-highlights';

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

export function SiteLogs({ className }: { className?: string }) {
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');

	// Keep each entry's original append-only index as its stable React key.
	const filteredLogs = logs
		.map((log, index) => ({ log, index }))
		.filter(({ log }) =>
			log.toLowerCase().includes(searchTerm.toLowerCase())
		);

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

	function logList() {
		return filteredLogs
			.slice()
			.reverse()
			.map(({ log, index }) => (
				<div className={css.logEntry} key={index}>
					{splitLogHighlights(log).map((segment, segmentIndex) =>
						segment.highlight ? (
							<mark key={segmentIndex}>{segment.text}</mark>
						) : (
							<Fragment key={segmentIndex}>
								{segment.text}
							</Fragment>
						)
					)}
				</div>
			));
	}

	return (
		<div className={classNames(css.logsComponent, className)}>
			{logs.length > 0 ? (
				<TextControl
					aria-label="Search"
					placeholder="Search logs"
					value={searchTerm}
					onChange={setSearchTerm}
					autoFocus={true}
					className={css.logSearch}
				/>
			) : null}
			<div className={css.logContentContainer}>
				{filteredLogs.length > 0 ? (
					<main className={css.logList}>{logList()}</main>
				) : logs.length > 0 ? (
					<div className={css.logEmptyPlaceholder}>
						<p className={css.logEmptyHint}>
							No logs match “{searchTerm}”.
						</p>
						<button
							type="button"
							className={css.logClearSearch}
							onClick={() => setSearchTerm('')}
						>
							Clear search
						</button>
					</div>
				) : (
					<div className={css.logEmptyState}>
						<p className={css.logEmptyTitle}>Nothing logged yet</p>
						<p className={css.logEmptyHint}>
							This is the combined log for your Playground. Three
							kinds of messages land here as you use it:
						</p>
						<ul className={css.logLegend}>
							<li>
								<span className={css.logLegendTerm}>PHP</span>
								<span className={css.logLegendDesc}>
									fatal errors, warnings, and notices from
									your code
								</span>
							</li>
							<li>
								<span className={css.logLegendTerm}>
									WordPress
								</span>
								<span className={css.logLegendDesc}>
									entries written to the debug log when
									WP_DEBUG is on
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
