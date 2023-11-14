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
import { normalizePath } from '@php-wasm/util';

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
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [repoPath, setRepoPath] = useState<string>('');
	const [repoBranch, setRepoBranch] = useState<string>('');
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(false);
	function handleChangeUrl(e: React.ChangeEvent<HTMLInputElement>) {
		setUrl(e.target.value.trim());
		setURLNeedsAnalyzing(true);
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!url) {
			return;
		}
		if (URLNeedsAnalyzing) {
			analyzeUrl();
			return;
		}
		await importUrl();
	}

	async function analyzeUrl() {
		setUrlType(undefined);
		setURLNeedsAnalyzing(false);

		const details = analyzeGitHubURL(url);
		setUrlType(details.type);
		if (details.type === 'unknown') {
			return;
		}

		setRepoPath(normalizePath('/' + details.path));

		setIsAnalyzing(true);
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
				} else if (['plugins', 'themes', 'mu-plugins'].includes(name)) {
					setContentType('wp-content');
				} else if (name.endsWith('.php')) {
					setContentType('plugin');
				}
			}
		}

		setIsAnalyzing(false);
	}

	async function importUrl() {
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
			{url && !URLNeedsAnalyzing && !isAnalyzing ? (
				<GitHubFormDetails
					contentType={contentType}
					setContentType={setContentType}
					repoPath={repoPath}
					setRepoPath={setRepoPath}
					urlType={urlType}
				/>
			) : (
				false
			)}
			{urlType !== 'unknown' ? (
				<div className={forms.submitRow}>
					<Button
						className={forms.btn}
						disabled={!url || isAnalyzing || isImporting}
						variant="primary"
						size="large"
					>
						{isAnalyzing ? (
							<>
								<Spinner size={20} />
								Analyzing the URL...
							</>
						) : isImporting ? (
							<>
								<Spinner size={20} />
								{` Importing... ${importProgress.downloadedFiles}/${importProgress.foundFiles} files downloaded`}
							</>
						) : (
							'Import'
						)}
					</Button>
				</div>
			) : (
				<div>Unknown URL type</div>
			)}
		</form>
	);
}
