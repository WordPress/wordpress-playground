import React from 'react';
import { useRef, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../button';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

export default function GitHubForm({
	playground,
	onImported,
	onClose,
}: GitHubFormProps) {
	const form = useRef<any>();
	const [url, setUrl] = useState<string>('');
	const [error, setError] = useState<string>('');
	const [pristine, setPristine] = useState<boolean>(true);
	function handleChangeUrl(e: React.ChangeEvent<HTMLInputElement>) {
		const _url = e.target.value;
		setUrl(_url);

		if (!pristine) {
			return;
		}

		const seemsLikeAProperURL =
			url.startsWith('https://') || url.startsWith('github.com');
		if (!seemsLikeAProperURL) {
			return;
		}

		setPristine(false);
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!url) {
			return;
		}

		onImported();
	}

	return (
		<form id="import-playground-form" ref={form} onSubmit={handleSubmit}>
			<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
				Import from GitHub
			</h2>
			<p className={css.modalText}>
				You may import your project from GitHub into the current
				WordPress Playground site.
			</p>
			<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
				{error ? <div className={forms.error}>{error}</div> : null}
				Repository / PR URL:
				<input type="text" value={url} onChange={handleChangeUrl} />
			</div>
			<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
				<ul>
					<li>Looks like that's a PR.</li>
					<li>Looks like that's a repo</li>
					<li>Looks like that's an artifact</li>
					<li>Playground doesn't recognize this URL</li>
				</ul>
			</div>
			<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
				What path in the repo do you want to load?
				<input type="text" value={url} onChange={handleChangeUrl} />
				<ul>
					<li>We've guessed this for you ^</li>
				</ul>
			</div>
			<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
				What is it?
				<ul>
					<li>Theme</li>
					<li>Plugin</li>
					<li>wp-content directory</li>
				</ul>
				<ul>
					<li>We've guessed this for you ^</li>
				</ul>
			</div>
			<div className={forms.submitRow}>
				<Button
					className={forms.btn}
					disabled={!url}
					variant="primary"
					size="large"
				>
					Import
				</Button>
			</div>
		</form>
	);
}
