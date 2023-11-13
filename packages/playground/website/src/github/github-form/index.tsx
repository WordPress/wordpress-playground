import React from 'react';
import { useRef, useState } from 'react';
import { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import { GitHubPointer, analyzeGitHubURL } from '../analyze-github-url';
import {
	GetFilesProgress,
	createClient,
	getFilesFromDirectory,
} from '@wp-playground/storage';
import { getOAuthToken } from '../token';
import { GitHubFormDetails } from './form-details';
import { ContentType, importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

const octokit = createClient(getOAuthToken()!);
export default function GitHubForm({
	playground,
	onImported,
	onClose,
}: GitHubFormProps) {
	const form = useRef<any>();
	const [error] = useState<string>('');
	const [url, setUrl] = useState<string>('');
	const [urlType, setUrlType] = useState<GitHubPointer['type'] | undefined>();
	const [contentType, setContentType] = useState<ContentType | undefined>();
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [repoPath, setRepoPath] = useState<string>('');
	const [repoBranch, setRepoBranch] = useState<string>('');
	const [pristine, setPristine] = useState<boolean>(true);
	function handleChangeUrl(e: React.ChangeEvent<HTMLInputElement>) {
		const newUrl = e.target.value;
		setUrl(newUrl);

		console.log({ pristine });
		if (!pristine) {
			// return;
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
		setRepoPath('/' + details.path.replace(/^\//, ''));

		async function loadRest() {
			setIsLoading(true);
			// Get default branch from the repo
			const repo = await octokit.rest.repos.get({
				owner: details.owner,
				repo: details.repo,
			});
			setRepoBranch(repo.data.default_branch);

			const { data: files } = await octokit.rest.repos.getContent({
				owner: details.owner,
				repo: details.repo,
				path: details.path,
				ref: repo.data.default_branch,
			});
			if (Array.isArray(files)) {
				for (const { name } of files) {
					if (name === 'theme.json') {
						setContentType('theme');
					} else if (
						['plugins', 'themes', 'mu-plugins'].includes(name)
					) {
						setContentType('wp-content');
					} else if (name.endsWith('.php')) {
						setContentType('plugin');
					}
				}
			}

			setIsLoading(false);
			console.log({ repo, files });
		}
		loadRest();
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!url) {
			return;
		}
		setIsImporting(true);
		const { owner, repo } = analyzeGitHubURL(url);

		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		const relativeRepoPath = repoPath.replace(/^\//g, '');
		const ghFiles = await getFilesFromDirectory(
			octokit,
			owner,
			repo,
			repoBranch,
			relativeRepoPath,
			(progress) => setImportProgress({ ...progress })
		);
		console.log(ghFiles);
		await importFromGitHub(
			playground,
			ghFiles,
			contentType!,
			repo,
			relativeRepoPath
		);
		setIsImporting(false);
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
			<GitHubFormDetails
				contentType={contentType}
				setContentType={setContentType}
				repoPath={repoPath}
				setRepoPath={setRepoPath}
				url={url}
				isLoading={isLoading}
				urlType={urlType}
			/>
			{urlType !== 'unknown' ? (
				<div className={forms.submitRow}>
					<Button
						className={forms.btn}
						disabled={!url || isLoading || isImporting}
						variant="primary"
						size="large"
					>
						{isImporting ? (
							<>
								<Spinner size={20} />
								{` Importing... ${importProgress.downloadedFiles}/${importProgress.foundFiles} files downloaded`}
							</>
						) : (
							'Import'
						)}
					</Button>
				</div>
			) : null}
		</form>
	);
}
