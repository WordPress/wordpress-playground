import { useEffect, useState } from 'react';
import Modal from '../modal';
import { logger } from '@php-wasm/logger';

import css from './style.module.css';

import { usePlaygroundContext } from '../../playground-context';
import { TextControl } from '@wordpress/components';

export function LogModal() {
	const { activeModal, setActiveModal } = usePlaygroundContext();
	const [logs, setLogs] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState('');

	useEffect(getLogs, [activeModal]);

	function getLogs() {
		setLogs(logger.getLogs());
	}

	function onClose() {
		setActiveModal(false);
	}

	function logList() {
		return logs
			.filter((log) =>
				log.toLowerCase().includes(searchTerm.toLowerCase())
			)
			.reverse()
			.map((log, index) => (
				<pre className={css.logModalLog} key={index}>
					{log}
				</pre>
			));
	}

	const styles = {
		content: { width: 800 },
	};

	return (
		<Modal isOpen={true} onRequestClose={onClose} styles={styles}>
			<header>
				<h2>Logs</h2>
				<TextControl
					title="Search"
					placeholder="Search logs"
					value={searchTerm}
					onChange={setSearchTerm}
					autoFocus={true}
					className={css.logModalSearch}
				/>
			</header>
			<main className={css.logModalMain}>{logList()}</main>
		</Modal>
	);
}
