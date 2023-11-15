import React from 'react';
import { useState } from 'react';
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
import { oAuthState, setOAuthToken } from '../state';
import { ContentType, importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { normalizePath } from '@php-wasm/util';
import { signal } from '@preact/signals-react';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onExported: (pointer: GitHubPointer) => void;
	onClose: () => void;
}

let octokitClient: any;
function getClient() {
	if (!octokitClient) {
		octokitClient = createClient(oAuthState.value.token!);
	}
	return octokitClient;
}

const url = signal('');
const errors = signal<Record<string, string>>({});
const pointer = signal<GitHubPointer | undefined>(undefined);

interface ExportFormState {
	intent: 'create-pr' | 'update-pr';
}

export default function GitHubForm({
	playground,
	onExported,
}: GitHubFormProps) {
	const [values, setValues] = useState<ExportFormState>({
		intent: 'create-pr',
	});
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		url.value = url.value.trim();
		errors.value = {};
		if (!url.value) {
			errors.value = {
				url: 'Please enter a URL',
			};
			return;
		}
		if (URLNeedsAnalyzing) {
			await analyzeUrl();
			if (pointer.value?.type === 'unknown') {
				errors.value = {
					url: 'This URL is not supported',
				};
			}
			return;
		}
		if (!pointer.value?.contentType) {
			errors.value = {
				contentType: 'Please select what you want to export',
			};
			return;
		}
		await exportUrl();
	}

	async function analyzeUrl() {
		setURLNeedsAnalyzing(false);
		pointer.value = undefined;

		setIsAnalyzing(true);
		try {
			const octokit = getClient();
			pointer.value = await analyzeGitHubURL(octokit, url.value);
			if (pointer.value.type === 'unknown') {
				return;
			}

			return pointer;
		} catch (e: any) {
			console.error(e);
			// Handle the "Bad Credentials" error
			if (e && e.status) {
				switch (e.status) {
					case 401:
						setOAuthToken(undefined);
						return;
					case 404:
						errors.value = {
							url: "This repo (or the resource in it) doesn't exist",
						};
						return;
				}
			}
			errors.value = { url: e.message };
			throw e;
		} finally {
			setIsAnalyzing(false);
		}
	}

	async function exportUrl() {
		setIsExporting(true);
		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		try {
			const octokit = getClient();

			const immutablePointer = pointer.value!;

			const relativeRepoPath = immutablePointer.path.replace(/^\//g, '');
			const ghFiles = await getFilesFromDirectory(
				octokit,
				immutablePointer.owner,
				immutablePointer.repo,
				immutablePointer.ref,
				relativeRepoPath,
				(progress) => setImportProgress({ ...progress })
			);
			await importFromGitHub(
				playground,
				ghFiles,
				immutablePointer.contentType!,
				immutablePointer.repo,
				relativeRepoPath
			);
			setIsExporting(false);
			onExported(immutablePointer);
		} catch (e) {
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			errors.value = {
				url: `There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`,
			};
			throw e;
		}
	}

	return (
		<GitHubOAuthGuard>
			<form onSubmit={handleSubmit}>
				<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
					Submit a Pull Request to GitHub
				</h2>
				<p className={css.modalText}>
					You may submit your changes to WordPress plugins, themes, and entire
					wp-content directories to your public GitHub repositories.
				</p>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						{' '}
						I want to target this GitHub repository or PR:
						<input
							type="text"
							value={url.value}
							className={css.repoInput}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>
							) => {
								url.value = e.target.value;
								setURLNeedsAnalyzing(true);
							}}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
					{'url' in errors.value ? (
						<div className={forms.error}>{errors.value.url}</div>
					) : null}
				</div>

				{pointer.value && !URLNeedsAnalyzing && !isAnalyzing ? (
					<>
						{pointer.value ? (
							<div>
								<h3>
									{pointer.value.type === 'pr' ? (
										<>
											Importing from Pull Request #
											{pointer.value.pr} at{' '}
											{pointer.value.owner}/
											{pointer.value.repo}
										</>
									) : pointer.value.type === 'branch' ? (
										<>
											Importing from branch{' '}
											{pointer.value.ref} at{' '}
											{pointer.value.owner}/
											{pointer.value.repo}
										</>
									) : pointer.value.type === 'repo' ? (
										<>
											Importing from the{' '}
											{pointer.value.owner}/
											{pointer.value.repo} repository
										</>
									) : (
										false
									)}
								</h3>
							</div>
						) : (
							false
						)}
						<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
							<label>
								{' '}
								I want to:
								<select
									value={
										values.intent
									}
									className={css.repoInput}
									onChange={(e) => {
										setValues({ intent: e.target.value as any })
									}}
								>
									<option value="">
										-- Select an option --
									</option>
									<option value="create-pr">Create a Pull Request</option>
									<option value="update-pr">
										Update an existing Pull Request
									</option>
								</select>
							</label>
							{'intent' in errors.value ? (
								<div className={forms.error}>{errors.value.intent}</div>
							) : null}
						</div>
						{['pr', 'branch', 'repo'].includes(
							pointer.value.type as any
						) ? (
							<>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										I am submitting a:
										<select
											value={
												pointer.value
													.contentType as string
											}
											className={css.repoInput}
											onChange={(e) => {
												pointer.value = {
													...pointer.value!,
													contentType: e.target
														.value as ContentType,
												};
											}}
										>
											<option value="">
												-- Select an option --
											</option>
											<option value="theme">Theme</option>
											<option value="plugin">
												Plugin
											</option>
											<option value="wp-content">
												wp-content directory
											</option>
										</select>
									</label>
									{'contentType' in errors.value ? (
										<div className={forms.error}>
											{errors.value.contentType}
										</div>
									) : null}
								</div>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										To the following path in the repo:
										<input
											type="text"
											className={css.repoInput}
											value={normalizePath(
												'/' + pointer.value.path
											)}
											onChange={(e) => {
												pointer.value = {
													...pointer.value!,
													path: e.target.value.replace(
														/^\/+/,
														''
													),
												};
											}}
										/>
									</label>
									{'path' in errors.value ? (
										<div className={forms.error}>
											{errors.value.path}
										</div>
									) : null}
								</div>
							</>
						) : (
							false
						)}
					</>
				) : (
					false
				)}
				<div className={forms.submitRow}>
					<Button
						disabled={!url || isAnalyzing || isExporting}
						type="submit"
						variant="primary"
						size="large"
					>
						{isAnalyzing ? (
							<>
								<Spinner size={20} />
								Analyzing the URL...
							</>
						) : isExporting ? (
							<>
								<Spinner size={20} />
								{` Importing... ${importProgress.downloadedFiles}/${importProgress.foundFiles} files downloaded`}
							</>
						) : (
							'Next'
						)}
					</Button>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}
