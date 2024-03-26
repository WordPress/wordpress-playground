import { useEffect, useState } from 'react';
import Modal from '../modal';
import { addFatalErrorListener, logger } from '@php-wasm/logger';
import { Button, TextareaControl, TextControl } from '@wordpress/components';

import css from './style.module.css';

export function ErrorReportModal() {
	const [showModal, setShowModal] = useState(false);
	const [loading, setLoading] = useState(false);
	const [text, setText] = useState('');
	const [logs, setLogs] = useState('');
	const [url, setUrl] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState('');

	useEffect(() => {
		addFatalErrorListener(logger, (e) => {
			const error = e as CustomEvent;
			if (error.detail?.source === 'php-wasm') {
				setShowModal(true);
				setText('');
				setLogs(error.detail.logs.join(''));
				setUrl(window.location.href);
			}
		});
	}, []);

	function resetForm() {
		setText('');
		setLogs('');
		setUrl('');
	}

	function resetSubmission() {
		setSubmitted(false);
		setSubmitError('');
	}

	function onClose() {
		setShowModal(false);
		resetForm();
		resetSubmission();
	}

	async function onSubmit() {
		setLoading(true);
		const formdata = new FormData();
		formdata.append('description', text);
		if (logs) {
			formdata.append('logs', logs);
		}
		if (url) {
			formdata.append('url', url);
		}
		try {
			const response = await fetch(
				'https://playground.wordpress.net/logger.php',
				{
					method: 'POST',
					body: formdata,
				}
			);
			setSubmitted(true);

			const body = await response.json();
			if (!body.ok) {
				throw new Error(body.error);
			}

			setSubmitError('');
			resetForm();
		} catch (e) {
			setSubmitError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}

	function getTitle() {
		if (!submitted) {
			return 'Report error';
		} else if (submitError) {
			return 'Failed to report the error';
		} else {
			return 'Thank you for reporting the error';
		}
	}

	function getContent() {
		if (!submitted) {
			return (
				<>
					Playground crashed because of an error. You can help resolve
					the issue by sharing the error details with us.
				</>
			);
		} else if (submitError) {
			return (
				<>
					We were unable to submit the error report. Please try again
					or open an{' '}
					<a href="https://github.com/WordPress/wordpress-playground/issues/">
						issue on GitHub.
					</a>
				</>
			);
		} else {
			return (
				<>
					Your report has been submitted to the{' '}
					<a href="https://wordpress.slack.com/archives/C06Q5DCKZ3L">
						Making WordPress #playground-logs Slack channel
					</a>{' '}
					and will be reviewed by the team.
				</>
			);
		}
	}

	/**
	 * Show the form if the error has not been submitted or if there was an error submitting it.
	 *
	 * @return {boolean}
	 */
	function showForm() {
		return !submitted || submitError;
	}

	return (
		<Modal isOpen={showModal} onRequestClose={onClose}>
			<header className={css.errorReportModalHeader}>
				<h2>{getTitle()}</h2>
				<p>{getContent()}</p>
			</header>
			{showForm() && (
				<>
					<main>
						<TextareaControl
							label="What happened?"
							help="Describe what caused the error and how can we reproduce it."
							value={text}
							onChange={setText}
							className={css.errorReportModalTextarea}
							required={true}
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
						<Button
							variant="primary"
							onClick={onSubmit}
							isBusy={loading}
							disabled={loading || !text}
						>
							Report error
						</Button>
						<Button onClick={onClose}>Cancel</Button>
					</footer>
				</>
			)}
		</Modal>
	);
}
