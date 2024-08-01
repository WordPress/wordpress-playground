import { useEffect, useState } from 'react';
import Modal from '../modal';
import { logEventType, logger } from '@php-wasm/logger';

import css from './style.module.css';

import { TextControl } from '@wordpress/components';
import {
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from '../../lib/redux-store';
import { useDispatch, useSelector } from 'react-redux';

export function LogModal(props: { description?: JSX.Element; title?: string }) {
	const activeModal = useSelector(
		(state: PlaygroundReduxState) => state.activeModal
	);
	const dispatch: PlaygroundDispatch = useDispatch();
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
	}, [activeModal]);

	function getLogs() {
		setLogs(logger.getLogs());
	}

	function onClose() {
		dispatch(setActiveModal(null));
	}

	function logList() {
		return filteredLogs.reverse().map((log, index) => (
			<div
				className={css.logModalLog}
				key={index}
				dangerouslySetInnerHTML={{
					__html: log.replace(/Error:|Fatal:/, '<mark>$&</mark>'),
				}}
			/>
		));
	}

	const styles = {
		content: { width: 800 },
	};

	return (
		<Modal isOpen={true} onRequestClose={onClose} styles={styles}>
			<header>
				<h2>{props.title || 'Error Logs'}</h2>
				{props.description}
				{logs.length > 0 ? (
					<TextControl
						aria-label="Search"
						placeholder="Search logs"
						value={searchTerm}
						onChange={setSearchTerm}
						autoFocus={true}
						className={css.logModalSearch}
					/>
				) : null}
			</header>
			{filteredLogs.length > 0 ? (
				<main className={css.logModalMain}>{logList()}</main>
			) : logs.length > 0 ? (
				<div className={css.logModalEmptyPlaceholder}>
					No matching logs found.
				</div>
			) : (
				<div className={css.logModalEmptyPlaceholder}>
					Error logs for Playground, WordPress, and PHP will show up
					here when something goes wrong.
					<br />
					<br />
					No problems so far – yay! 🎉
				</div>
			)}
		</Modal>
	);
}
