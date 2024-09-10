import { useEffect, useState } from 'react';
import Modal from '../modal';
import { logEventType, logger } from '@php-wasm/logger';

import classNames from 'classnames';
import css from './style.module.css';

import { TextControl } from '@wordpress/components';
import {
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from '../../lib/state/redux/store';
import { useDispatch, useSelector } from 'react-redux';

export function LogModal(props: { description?: JSX.Element; title?: string }) {
	const activeModal = useSelector(
		(state: PlaygroundReduxState) => state.activeModal
	);
	const dispatch: PlaygroundDispatch = useDispatch();

	function onClose() {
		dispatch(setActiveModal(null));
	}

	const styles = {
		content: { width: 800 },
	};

	return (
		<Modal isOpen={true} onRequestClose={onClose} styles={styles}>
			<header>
				<h2>{props.title || 'Error Logs'}</h2>
				{props.description}
			</header>
			<SiteLogs key={activeModal} className={css.logsInsideModal} />
		</Modal>
	);
}

export function SiteLogs({ className }: { className?: string }) {
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');

	const filteredLogs = logs.filter((log) =>
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
					<div className={css.logEmptyPlaceholder}>
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
