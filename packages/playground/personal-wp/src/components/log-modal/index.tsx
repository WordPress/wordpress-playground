import { useEffect, useState } from 'react';
import {
	logEventType,
	logger,
	errorLogPath,
	LogSeverity,
} from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/remote';

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
import { usePlaygroundClient } from '../../lib/use-playground-client';

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

/**
 * Read debug.log from the playground filesystem and feed any
 * new entries into the logger so they show up in the UI.
 */
// Warnings from WordPress cron jobs that fail because
// networking is not enabled. These are expected and not
// actionable by the user.
const ignoredPatterns = [
	'wp_update_plugins()',
	'wp_update_themes()',
	'wp_version_check()',
];
const debugLogReadOffsets = new WeakMap<PlaygroundClient, number>();

function isIgnoredLogLine(line: string): boolean {
	return ignoredPatterns.some((pattern) => line.includes(pattern));
}

async function refreshDebugLog(playground: PlaygroundClient) {
	try {
		if (!(await playground.fileExists(errorLogPath))) {
			return;
		}
		const content = await playground.readFileAsText(errorLogPath);
		let readOffset = debugLogReadOffsets.get(playground) ?? 0;
		if (content.length < readOffset) {
			readOffset = 0;
		}
		const unreadContent = content.slice(readOffset);
		debugLogReadOffsets.set(playground, content.length);
		const filtered = unreadContent
			.split('\n')
			.filter((line) => line.trim() && !isIgnoredLogLine(line))
			.join('\n');
		if (filtered.length > 0) {
			logger.logMessage({
				message: filtered,
				severity: LogSeverity.Log,
				raw: true,
			});
		}
	} catch {
		// Playground may not be ready yet
	}
}

export function SiteLogs({ className }: { className?: string }) {
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const playground = usePlaygroundClient();

	const filteredLogs = logs.filter((log) =>
		log.toLowerCase().includes(searchTerm.toLowerCase())
	);

	useEffect(() => {
		getLogs();
		// Read debug.log on mount to pick up errors that
		// were written outside of request.end events.
		if (playground) {
			refreshDebugLog(playground).then(getLogs);
		}
		logger.addEventListener(logEventType, getLogs);
		return () => {
			logger.removeEventListener(logEventType, getLogs);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [playground]);

	function getLogs() {
		// TODO: Fix log querying/listing to be per site
		setLogs(logger.getLogs());
	}

	function logList() {
		return filteredLogs.reverse().map((log, index) => (
			<div
				className={css.logEntry}
				key={index}
				dangerouslySetInnerHTML={{
					__html: log.replace(/Error:|Fatal:/, '<mark>$&</mark>'),
				}}
			/>
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
						No matching logs found.
					</div>
				) : (
					<div>
						Error logs for Playground, WordPress, and PHP will show
						up here when something goes wrong.
						<br />
						<br />
						No problems so far – yay! 🎉
					</div>
				)}
			</div>
		</div>
	);
}
