import React from 'react';
import { useMemo, useRef, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import { FilePickerControl } from '@wp-playground/components';
import { Button as WordPressButton } from '@wordpress/components';

import css from './style.module.css';
import forms from '../../forms.module.css';
import type { GitHubURLInformation } from '../analyze-github-url';
import {
	normalizeGitHubRepositoryInput,
	resolveGitHubBranchPath,
	staticAnalyzeGitHubURL,
} from '../analyze-github-url';
import type { GetFilesProgress, GithubClient } from '@wp-playground/storage';
import {
	getFilesFromDirectory,
	removePathPrefix,
} from '@wp-playground/storage';
import { setOAuthToken } from '../state';
import {
	getAuthenticatedGitHubClient as getClient,
	resetAuthenticatedGitHubClient as resetClient,
} from '../client';
import type { ContentType } from '../import-from-github';
import { importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { basename, ensureAbsolutePath } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import { GitHubRepositoryFilesystem } from './github-repository-filesystem';
import { inferContentType } from './infer-content-type';
import { getImportTargetLabel } from './import-labels';

export interface GitHubImportFormProps {
	playground: PlaygroundClient;
	getPlaygroundBeforeImport?: () => Promise<PlaygroundClient>;
	onRepositoryResolved?: () => void;
	onRepositoryChange?: () => void;
	showRepositoryDetails?: boolean;
	onImported: (details: {
		url: string;
		urlInformation: GitHubURLInformation;
		branch: string;
		path: string;
		contentType: ContentType;
		pluginOrThemeName: string;
		files: any[];
	}) => void;
	onClose: () => void;
}

type ContentTypeSelection = {
	contentType: ContentType;
	source: 'inferred' | 'manual';
};

export default function GitHubImportForm({
	playground,
	getPlaygroundBeforeImport,
	onRepositoryResolved,
	onRepositoryChange,
	showRepositoryDetails = true,
	onImported,
}: GitHubImportFormProps) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isInspectingPath, setIsInspectingPath] = useState<boolean>(false);
	const [importPhase, setImportPhase] = useState<
		'idle' | 'downloading' | 'applying'
	>('idle');
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [url, setUrl] = useState<string>('');
	const latestUrlRef = useRef(url);
	const analysisRunRef = useRef(0);
	const pathInspectionRunRef = useRef(0);
	const [urlInformation, setUrlInformation] = useState<
		GitHubURLInformation | undefined
	>();
	const [contentTypeSelection, setContentTypeSelection] = useState<
		ContentTypeSelection | undefined
	>();
	const [path, setPath] = useState<string>('');
	const branch = urlInformation?.ref ?? '';
	const contentType = contentTypeSelection?.contentType;
	const isContentTypeInferred = contentTypeSelection?.source === 'inferred';
	const isImporting = importPhase !== 'idle';
	const repositoryFilesystem = useMemo(() => {
		if (
			!urlInformation?.owner ||
			!urlInformation.repo ||
			!(urlInformation.commitSha || urlInformation.ref)
		) {
			return undefined;
		}
		return new GitHubRepositoryFilesystem(
			getClient,
			urlInformation.owner,
			urlInformation.repo,
			urlInformation.commitSha || urlInformation.ref!
		);
	}, [
		urlInformation?.commitSha,
		urlInformation?.owner,
		urlInformation?.ref,
		urlInformation?.repo,
	]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const repositoryInput = url.trim();
		const normalizedUrl = normalizeGitHubRepositoryInput(repositoryInput);
		setUrl(repositoryInput);
		latestUrlRef.current = repositoryInput;
		setErrors({});
		if (!repositoryInput) {
			setErrors({
				url: 'Please enter a repository',
			});
			return;
		}
		if (!urlInformation) {
			const info = staticAnalyzeGitHubURL(normalizedUrl);
			if (!['pr', 'branch', 'repo'].includes(info.type)) {
				setErrors({
					url: 'Enter owner/repository or a GitHub repository URL',
				});
				return;
			}
			const octokit = getClient();
			// Only keep the most recent analysis run if the user triggers
			// multiple analysis attempts.
			const analysisRun = ++analysisRunRef.current;
			setIsAnalyzing(true);
			try {
				const importSource = await resolveImportSource(octokit, info);
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== repositoryInput
				) {
					return;
				}
				const guessedContentType = await inspectContentType(
					octokit,
					importSource
				);
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== repositoryInput
				) {
					return;
				}
				setUrlInformation(importSource);
				setPath(importSource.path ?? '');
				setContentTypeSelection(
					guessedContentType
						? {
								contentType: guessedContentType,
								source: 'inferred',
							}
						: undefined
				);
				onRepositoryResolved?.();
				return;
			} catch (e: any) {
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== repositoryInput
				) {
					return;
				}
				logger.error(e);
				// Handle the "Bad Credentials" error
				if (e && e.status) {
					switch (e.status) {
						case 401:
							setOAuthToken(undefined);
							resetClient();
							return;
						case 404:
							setErrors({
								url: "This repo (or the resource in it) doesn't exist",
							});
							return;
					}
				}
				setErrors({ url: e.message });
				return;
			} finally {
				if (analysisRunRef.current === analysisRun) {
					setIsAnalyzing(false);
				}
			}
		}
		if (!showRepositoryDetails) {
			onRepositoryResolved?.();
			return;
		}
		if (!contentType) {
			setErrors({
				contentType: 'Please select what you want to import',
			});
			return;
		}
		setImportPhase('downloading');
		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		try {
			const octokit = getClient();
			const relativeRepoPath = removePathPrefix(
				ensureAbsolutePath(path),
				'/'
			);
			const pluginOrThemeName =
				basename(relativeRepoPath) || urlInformation!.repo!;
			// Use the commit resolved during analysis so a branch moving
			// mid-flow cannot change the files being imported.
			const ghFiles = await getFilesFromDirectory(
				octokit,
				urlInformation!.owner!,
				urlInformation!.repo!,
				urlInformation!.commitSha || branch!,
				relativeRepoPath,
				{
					onProgress: (progress) =>
						setImportProgress({ ...progress }),
				}
			);
			setImportPhase('applying');
			const targetPlayground = getPlaygroundBeforeImport
				? await getPlaygroundBeforeImport()
				: playground;
			await importFromGitHub(
				targetPlayground,
				ghFiles,
				contentType!,
				relativeRepoPath,
				pluginOrThemeName
			);
			targetPlayground.goTo('/');
			onImported({
				url: normalizeGitHubRepositoryInput(url),
				urlInformation: urlInformation!,
				path: path!,
				contentType,
				branch: branch!,
				pluginOrThemeName,
				files: ghFiles,
			});
		} catch (e) {
			if ((e as any)?.status === 401) {
				setOAuthToken(undefined);
				resetClient();
				return;
			}
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setErrors({
				url: `There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`,
			});
			return;
		} finally {
			setImportPhase('idle');
		}
	}

	async function handlePathChange(selectedPath: string) {
		if (!urlInformation) {
			return;
		}
		const relativePath = removePathPrefix(
			ensureAbsolutePath(selectedPath),
			'/'
		);
		const inspectionRun = ++pathInspectionRunRef.current;
		setPath(relativePath);
		setContentTypeSelection(undefined);
		setErrors({});
		setIsInspectingPath(true);
		try {
			const guessedContentType = await inspectContentType(getClient(), {
				...urlInformation,
				path: relativePath,
			});
			if (pathInspectionRunRef.current !== inspectionRun) {
				return;
			}
			setContentTypeSelection(
				guessedContentType
					? {
							contentType: guessedContentType,
							source: 'inferred',
						}
					: undefined
			);
		} catch (error) {
			if (pathInspectionRunRef.current !== inspectionRun) {
				return;
			}
			if ((error as { status?: number })?.status === 401) {
				setOAuthToken(undefined);
				resetClient();
				setUrlInformation(undefined);
				return;
			}
			logger.error(error);
			setErrors({
				path:
					(error as Error)?.message ||
					'Could not inspect this repository path.',
			});
		} finally {
			if (pathInspectionRunRef.current === inspectionRun) {
				setIsInspectingPath(false);
			}
		}
	}

	function handleChangeRepository() {
		analysisRunRef.current++;
		pathInspectionRunRef.current++;
		setIsAnalyzing(false);
		setIsInspectingPath(false);
		setUrlInformation(undefined);
		setContentTypeSelection(undefined);
		setPath('');
		setErrors({});
		onRepositoryChange?.();
	}

	const importTargetLabel = contentType
		? getImportTargetLabel(contentType)
		: undefined;
	const showRepositorySummary = Boolean(
		urlInformation && showRepositoryDetails
	);

	return (
		<GitHubOAuthGuard>
			<form
				id="import-playground-form"
				className={css.importForm}
				onSubmit={handleSubmit}
			>
				{showRepositorySummary ? (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast} ${css.repositorySummary}`}
					>
						<div className={css.repositoryIdentity}>
							<span className={css.repositoryLabel}>
								GitHub repository
							</span>
							<strong className={css.repositoryName}>
								{urlInformation?.owner}/{urlInformation?.repo}
							</strong>
						</div>
						<WordPressButton
							type="button"
							variant="tertiary"
							className={css.changeRepository}
							disabled={isImporting}
							onClick={handleChangeRepository}
						>
							Change
						</WordPressButton>
						{'url' in errors ? (
							<div
								className={`${forms.error} ${css.repositoryError}`}
							>
								{errors.url}
							</div>
						) : null}
					</div>
				) : (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							GitHub repository
							<input
								type="text"
								name="repository"
								value={url}
								className={css.repoInput}
								onChange={(
									event: React.ChangeEvent<HTMLInputElement>
								) => {
									const nextUrl = event.target.value;
									latestUrlRef.current = nextUrl;
									analysisRunRef.current++;
									pathInspectionRunRef.current++;
									setUrl(nextUrl);
									setIsAnalyzing(false);
									setIsInspectingPath(false);
									setUrlInformation(undefined);
									setContentTypeSelection(undefined);
									setPath('');
									setErrors({});
								}}
								placeholder="owner/repository"
								autoFocus={!urlInformation}
							/>
						</label>
						<p className={css.fieldHint}>
							Enter owner/repository or a GitHub URL.
						</p>
						{'url' in errors ? (
							<div className={forms.error}>{errors.url}</div>
						) : null}
					</div>
				)}
				{urlInformation &&
				showRepositoryDetails &&
				!isAnalyzing &&
				repositoryFilesystem ? (
					<>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<div className={css.fieldLabel}>
								Path in repository
							</div>
							<FilePickerControl
								key={`${urlInformation.owner}/${urlInformation.repo}@${urlInformation.commitSha}`}
								value={ensureAbsolutePath(path)}
								filesystem={repositoryFilesystem}
								root="/"
								readOnly
								directoriesOnly
								disabled={isImporting}
								onChange={handlePathChange}
							/>
							{isInspectingPath ? (
								<div className={css.pathStatus} role="status">
									<Spinner size={20} />
									Inspecting the selected path...
								</div>
							) : null}
							{'path' in errors ? (
								<div className={forms.error}>{errors.path}</div>
							) : null}
						</div>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<label>
								<span className={css.fieldHeading}>
									<span>Import as</span>
									{isContentTypeInferred ? (
										<span className={css.inferredStatus}>
											Detected automatically
										</span>
									) : null}
								</span>
								<select
									name="contentType"
									value={contentType ?? ''}
									className={css.repoInput}
									disabled={isInspectingPath || isImporting}
									onChange={(event) => {
										setContentTypeSelection(
											event.target.value
												? {
														contentType: event
															.target
															.value as ContentType,
														source: 'manual',
													}
												: undefined
										);
										setErrors((current) => {
											const next = { ...current };
											delete next.contentType;
											return next;
										});
									}}
								>
									<option value="">Select a type</option>
									<option value="plugin">Plugin</option>
									<option value="theme">Theme</option>
									<option value="wp-content">
										wp-content directory
									</option>
								</select>
							</label>
							{'contentType' in errors ? (
								<div className={forms.error}>
									{errors.contentType}
								</div>
							) : null}
						</div>
					</>
				) : null}
				<div className={forms.submitRow}>
					<WordPressButton
						className={css.submitButton}
						disabled={
							!url ||
							isAnalyzing ||
							isInspectingPath ||
							isImporting ||
							(Boolean(urlInformation && showRepositoryDetails) &&
								!contentType)
						}
						type="submit"
						variant="primary"
					>
						{isAnalyzing ? (
							<>
								<Spinner size={20} />
								Analyzing the repository...
							</>
						) : isInspectingPath ? (
							<>
								<Spinner size={20} />
								Inspecting the selected path...
							</>
						) : isImporting ? (
							<>
								<Spinner size={20} />
								{importPhase === 'downloading'
									? `Downloading files…${
											importProgress.foundFiles
												? ` ${importProgress.downloadedFiles} of ${importProgress.foundFiles}`
												: ''
										}`
									: `Importing ${importTargetLabel}…`}
							</>
						) : urlInformation && showRepositoryDetails ? (
							importTargetLabel ? (
								`Import ${importTargetLabel}`
							) : (
								'Import'
							)
						) : (
							'Continue'
						)}
					</WordPressButton>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}

/**
 * Resolves the exact repository ref that should be imported.
 */
async function resolveImportSource(
	octokit: GithubClient,
	urlDetails: GitHubURLInformation
): Promise<GitHubURLInformation> {
	if (urlDetails.type === 'pr') {
		const prDetails = await octokit.rest.pulls.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
			pull_number: urlDetails.pr!,
		});
		if (!prDetails.data.head.repo) {
			throw new Error(
				'This pull request cannot be imported because its source repository is unavailable.'
			);
		}
		return {
			...urlDetails,
			owner: prDetails.data.head.repo.owner.login,
			repo: prDetails.data.head.repo.name,
			ref: prDetails.data.head.ref,
			commitSha: prDetails.data.head.sha,
		};
	}
	if (urlDetails.type === 'repo') {
		const {
			data: { default_branch },
		} = await octokit.rest.repos.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
		});
		const { data: branch } = await octokit.rest.repos.getBranch({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
			branch: default_branch,
		});
		return {
			...urlDetails,
			ref: default_branch,
			commitSha: branch.commit.sha,
		};
	}
	return resolveGitHubBranchPath(octokit, urlDetails);
}

async function inspectContentType(
	octokit: GithubClient,
	{ owner, repo, path, ref, commitSha }: GitHubURLInformation
): Promise<ContentType | undefined> {
	const { data: files } = await octokit.rest.repos.getContent({
		owner: owner!,
		repo: repo!,
		path: path!,
		ref: commitSha || ref,
	});
	if (!Array.isArray(files)) {
		throw new Error('Select a directory to import.');
	}
	return inferContentType(files);
}
