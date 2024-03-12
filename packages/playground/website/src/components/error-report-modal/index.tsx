import { useEffect, useState } from 'react';
import Modal from '../modal';
import { addFatalErrorListener, logger } from '@php-wasm/logger';
import { Button, TextareaControl, TextControl } from '@wordpress/components';

import css from './style.module.css';

export function ErrorReportModal() {
	const [hasError, setHasError] = useState(false);
	const [text, setText] = useState('');
	const [logs, setLogs] = useState('');
	const [url, setUrl] = useState('');
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		addFatalErrorListener(logger, (e) => {
			setHasError(true);
			setText('');
			setLogs((e as CustomEvent).detail.logs.join(''));
			setUrl(window.location.href);
		});
	}, []);

	function onClose() {
		setHasError(false);
		setText('');
		setLogs('');
		setUrl('');
		setSubmitted(false);
	}

	function onSubmit() {
		const data = ['What happened?', text, 'Logs', logs, 'Url', url].join(
			'\n\n'
		);
		console.log(data);
		// TODO: send data to the server
		setSubmitted(true);
	}

	return (
		<Modal isOpen={hasError} onRequestClose={onClose}>
			{submitted && (
				<header className={css.errorReportModalHeader}>
					<h2>Thank you for reporting the error</h2>
					<p>
						We will look into the issue and and open an{' '}
						<a href="https://github.com/WordPress/wordpress-playground/issues/">
							issue on GitHub if needed
						</a>
						.
					</p>
				</header>
			)}
			{!submitted && (
				<>
					<header className={css.errorReportModalHeader}>
						<h2>Report error</h2>
						<p>
							Playground crashed because of an error. We would
							appreciate it if you would report this error so that
							we can fix it.
						</p>
						<p>
							It is possible that the error was caused by PHP code
							and is unrelated to Playground. The log might help
							you fix the PHP error.
						</p>
					</header>
					<main>
						<TextareaControl
							label="What happened?"
							help="Describe what caused the error and how can we reproduce it."
							value={text}
							onChange={setText}
							className={css.errorReportModalTextarea}
						/>
						{logs && (
							<TextareaControl
								label="Logs"
								value={logs}
								onChange={setLogs}
								className={css.errorReportModalTextarea}
							/>
						)}
						{url && (
							<TextControl
								label="Url"
								value={url}
								onChange={setUrl}
							/>
						)}
					</main>
					<footer className={css.errorReportModalFooter}>
						<Button variant="primary" onClick={onSubmit}>
							Report error
						</Button>
						<Button onClick={onClose}>Cancel</Button>
					</footer>
				</>
			)}
		</Modal>
	);
}
