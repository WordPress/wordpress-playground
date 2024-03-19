import { useEffect, useState } from 'react';
import Modal from '../modal';
import { addFatalErrorListener, logger } from '@php-wasm/logger';
import { Button, TextareaControl, TextControl } from '@wordpress/components';

import css from './style.module.css';
import { set } from 'cypress/types/lodash';

export function ErrorReportModal() {
	const [hasError, setHasError] = useState(true);
	const [text, setText] = useState('');
	const [logs, setLogs] = useState('');
	const [url, setUrl] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState(false);

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
		setSubmitError(false);
	}

	async function onSubmit() {
		const data = ['What happened?', text, 'Logs', logs, 'Url', url].join(
			'\n\n'
		);

		const formdata = new FormData();
		formdata.append('data', data);
		try {
			const response = await fetch(
				'https://playground.wordpress.net/logger.php',
				{
					method: 'POST',
					body: formdata,
				}
			);
			if (!response.ok) {
				throw new Error('Failed to submit the error');
			}
			setSubmitted(true);
		} catch (e) {
			setSubmitError(true);
		}
	}

	return (
		<Modal isOpen={hasError} onRequestClose={onClose}>
			{submitted && (
				<header className={css.errorReportModalHeader}>
					<h2>Thank you for reporting the error</h2>
					<p>
						Your report has been submitted to the{' '}
						<a href="https://wordpress.slack.com/archives/C06Q5DCKZ3L">
							Making WordPress #playground-logs Slack channel
						</a>{' '}
						and will be reviewed by the team.
					</p>
				</header>
			)}
			{submitError && (
				<header className={css.errorReportModalHeader}>
					<h2>Failed to report the error</h2>
					<p>
						We were unable to submit the error report. Please try
						again or open an{' '}
						<a href="https://github.com/WordPress/wordpress-playground/issues/">
							issue on GitHub.
						</a>
					</p>
				</header>
			)}
			{!submitted && (
				<>
					<header className={css.errorReportModalHeader}>
						<h2>Report error</h2>
						<p>
							Playground crashed because of an error. You can help
							resolve the issue by sharing the error details with
							us.
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
						<TextareaControl
							label="Logs"
							value={logs}
							onChange={setLogs}
							className={css.errorReportModalTextarea}
						/>

						<TextControl
							label="Url"
							value={url}
							onChange={setUrl}
						/>
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
