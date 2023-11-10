import React from 'react';
import { useRef, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import { GitHubPointer, analyzeGitHubURL } from '../analyze-github-url';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

type ContentType = 'theme' | 'plugin' | 'wp-content';

export default function GitHubForm({
	playground,
	onImported,
	onClose,
}: GitHubFormProps) {
	const form = useRef<any>();
	const [error] = useState<string>('');
	const [url, setUrl] = useState<string>('');
	const [urlType, setUrlType] = useState<GitHubPointer['type'] | null>();
	const [contentType, setContentType] = useState<ContentType | null>();
	const [repoPath, setRepoPath] = useState<string>('');
	const [pristine, setPristine] = useState<boolean>(true);
	function handleChangeUrl(e: React.ChangeEvent<HTMLInputElement>) {
		const newUrl = e.target.value;
		setUrl(newUrl);

		console.log({ pristine });
		if (!pristine) {
			return;
		}

		const seemsLikeAProperURL =
			newUrl.startsWith('https://') || newUrl.startsWith('github.com');
		if (!seemsLikeAProperURL) {
			return;
		}

		setPristine(false);

		// Make guesses about the repo
		// PR or repo URL?
		const details = analyzeGitHubURL(newUrl);
		setUrlType(details.type);
		setRepoPath(details.path);
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
				<input
					type="text"
					value={url}
					onChange={handleChangeUrl}
					autoFocus
				/>
			</div>
			{url ? (
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					{urlType === 'pr' ? (
						<>Looks like that's a PR</>
					) : urlType === 'branch' ? (
						<>Looks like that's a branch</>
					) : urlType === 'zip' ? (
						<>Looks like that's an artifact</>
					) : (
						<>Playground doesn't recognize this URL</>
					)}
				</div>
			) : null}
			{urlType === 'pr' || urlType === 'branch' ? (
				<>
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						What path in the repo do you want to load?
						<input
							type="text"
							value={repoPath}
							onChange={(e) => setRepoPath(e.target.value)}
						/>
						<ul>
							<li>We've guessed this for you ^</li>
						</ul>
					</div>
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						What is it?
						<select
							value={contentType as string}
							onChange={(e) =>
								setContentType(e.target.value as ContentType)
							}
						>
							<option value="theme">Theme</option>
							<option value="plugin">Plugin</option>
							<option value="wp-content">
								wp-content directory
							</option>
						</select>
						We've guessed this for you ^
					</div>
				</>
			) : null}
			{urlType !== 'unknown' ? (
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
			) : null}
		</form>
	);
}
