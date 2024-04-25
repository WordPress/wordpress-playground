import { useEffect, useState } from 'react';
import Modal from '../modal';
import { addCrashListener, logger } from '@php-wasm/logger';

import css from './style.module.css';

import { usePlaygroundContext } from '../../playground-context';

export function LogModal() {
	const { activeModal, setActiveModal } = usePlaygroundContext();
	const [logs, setLogs] = useState('');

	useEffect(() => {
		addCrashListener(logger, (e) => {
			const error = e as CustomEvent;
			if (error.detail?.source === 'php-wasm') {
				setActiveModal('log');
			}
		});
	}, [setActiveModal]);

	useEffect(() => {
		if (activeModal) {
			setLogs(logger.getLogs().join('\n'));
		}
	}, [activeModal, setActiveModal, logs, setLogs]);

	function onClose() {
		setActiveModal(false);
	}

	function showModal() {
		return activeModal === 'log';
	}

	return (
		<Modal isOpen={showModal()} onRequestClose={onClose}>
			<header className={css.errorReportModalHeader}>
				<h2>Logs</h2>
			</header>
			<main>
				<pre>{logs}</pre>
			</main>
		</Modal>
	);
}
