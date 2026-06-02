/**
 * PlaygroundPreview component.
 *
 * This is an interactive code editor integrated with WordPress Playground's
 * live preview functionality. It supports multi-file editing with syntax
 * highlighting, JSX transpilation, and real-time WordPress preview.
 *
 * Adapted from the WordPress Playground Block plugin to work as a standalone
 * React component without WordPress dependencies.
 */

import { useEffect, useRef, useState, useId } from 'react';
import ReactCodeMirror from '@uiw/react-codemirror';
import { keymap, EditorView } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import type { LanguageSupport } from '@codemirror/language';
import {
	startPlaygroundWeb,
	type PlaygroundClient,
	phpVar,
} from '@wp-playground/client';

import useEditorFiles, { isErrorLogFile } from './use-editor-files';
import { writePluginFiles } from './write-plugin-files';
import { writeThemeFiles } from './write-theme-files';
import downloadZippedPackage from './download-zipped-package';
import FileManagementModals, {
	type FileManagerRef,
} from './file-management-modals';
import {
	transpilePluginFiles,
	type TranspilationFailure,
} from './transpile-plugin-files';
import { __, _x, sprintf } from '../../i18n';
import {
	base64EncodeBlockAttributes,
	stringToBase64,
	type Attributes,
	type EditorFile,
} from '../../base64';
import {
	IconPlus,
	IconDownload,
	IconCancel,
	IconWordPress,
	IconEdit,
	IconLink,
	IconPlay,
} from './icons';
import { speak } from '@wordpress/a11y';

export type PlaygroundDemoProps = Partial<Attributes> & {
	showAddNewFile?: boolean;
	showFileControls?: boolean;
	inFullPageView?: boolean;
	baseAttributesForFullPageView?: Record<string, unknown>;
	onStateChange?: (state: {
		client: PlaygroundClient | null;
		postId: number;
		files: EditorFile[];
	}) => void;
};

const languages: Record<string, LanguageSupport> = {
	css: css(),
	html: html(),
	js: javascript(),
	jsx: javascript({ jsx: true }),
	json: json(),
	php: php(),
};

function getLanguageExtensions(extension: string): LanguageSupport[] {
	return extension in languages ? [languages[extension]] : [];
}

/**
 * Playground's `goTo` method doesn't work when the URL is the same as the
 * current URL. This function returns a URL that forces a refresh by adding
 * or removing a query parameter.
 */
function getRefreshPath(lastPath: string): string {
	const url = new URL(lastPath, 'https://playground.wordpress.net');
	if (url.searchParams.has('__playground_refresh')) {
		url.searchParams.delete('__playground_refresh');
	} else {
		url.searchParams.set('__playground_refresh', '1');
	}
	return url.pathname + url.search;
}

function classNames(
	...args: (string | Record<string, boolean> | undefined)[]
): string {
	const classes: string[] = [];
	for (const arg of args) {
		if (typeof arg === 'string') {
			classes.push(arg);
		} else if (typeof arg === 'object' && arg !== null) {
			for (const [key, value] of Object.entries(arg)) {
				if (value) classes.push(key);
			}
		}
	}
	return classes.join(' ');
}

export default function PlaygroundPreview({
	blueprint = '',
	blueprintUrl = '',
	configurationSource = 'block-attributes',
	codeEditor = true,
	codeEditorMode = 'plugin',
	codeEditorSideBySide = true,
	codeEditorReadOnly = false,
	codeEditorTranspileJsx = false,
	codeEditorErrorLog = false,
	constants = {},
	logInUser = true,
	createNewPost = false,
	createNewPostType = 'post',
	createNewPostTitle = _x(
		'New post',
		'default title of new post created by blueprint'
	),
	createNewPostContent = '',
	redirectToPost = false,
	redirectToPostType = 'front',
	landingPageUrl = '/',
	files: filesAttribute = [],
	showAddNewFile = false,
	showFileControls = false,
	requireLivePreviewActivation = true,
	inFullPageView = false,
	baseAttributesForFullPageView = {},
	onStateChange,
}: PlaygroundDemoProps) {
	const {
		files,
		addFile,
		isLoading: isFilesLoading,
		updateFile,
		removeFile,
		activeFile,
		activeFileIndex,
		setActiveFileIndex,
	} = useEditorFiles(filesAttribute || [], {
		withErrorLog: codeEditorErrorLog,
		getErrors: async () =>
			(await playgroundClientRef.current?.readFileAsText(
				'/internal/stderr'
			)) || '',
	});

	const runButtonDescId = useId();
	const activateButtonDescId = useId();

	const iframeRef = useRef<HTMLIFrameElement>(null);
	const beforePreviewRef = useRef<HTMLSpanElement>(null);
	const afterPreviewRef = useRef<HTMLSpanElement>(null);
	const playgroundClientRef = useRef<PlaygroundClient | null>(null);
	const fileMgrRef = useRef<FileManagerRef>(null);
	const downloadButtonRef = useRef<HTMLButtonElement>(null);
	const codeMirrorRef = useRef<{ view?: EditorView }>(null);

	// Prevent CodeMirror keyboard shortcuts from propagating
	useEffect(() => {
		if (!codeMirrorRef.current?.view) return;

		const view = codeMirrorRef.current.view;
		function stopPropagation(event: KeyboardEvent) {
			event.stopPropagation();
		}
		view.dom.addEventListener('keydown', stopPropagation);
		view.dom.addEventListener('keypress', stopPropagation);
		view.dom.addEventListener('keyup', stopPropagation);
		return () => {
			view.dom.removeEventListener('keydown', stopPropagation);
			view.dom.removeEventListener('keyup', stopPropagation);
			view.dom.removeEventListener('keypress', stopPropagation);
		};
	}, []);

	const [isLivePreviewActivated, setLivePreviewActivated] = useState(
		!requireLivePreviewActivation
	);
	const [currentPostId, setCurrentPostId] = useState(0);
	const [isPlaygroundReady, setIsPlaygroundReady] = useState(false);

	const dismissedExitWithKeyboardTipKey =
		'playground-block-dismiss-exit-editor-tip';
	const [dismissedExitWithKeyboardTip, setDismissedExitWithKeyboardTip] =
		useState(
			typeof localStorage !== 'undefined' &&
				localStorage[dismissedExitWithKeyboardTipKey] === 'true'
		);

	function dismissExitWithKeyboardTip() {
		if (downloadButtonRef?.current) {
			downloadButtonRef.current.focus();
		}
		if (typeof localStorage !== 'undefined') {
			localStorage[dismissedExitWithKeyboardTipKey] = 'true';
		}
		setDismissedExitWithKeyboardTip(true);
		speak(__('Notice dismissed.'), 'polite');
	}

	// Notify parent component of state changes
	useEffect(() => {
		onStateChange?.({
			client: playgroundClientRef.current,
			postId: currentPostId,
			files,
		});
	}, [playgroundClientRef.current, currentPostId, files, onStateChange]);

	const currentFileExtension = activeFile?.name.split('.').pop() || '';

	// Initialize Playground when live preview is activated
	useEffect(() => {
		async function initPlayground() {
			if (!isLivePreviewActivated) return;
			if (!iframeRef.current) return;

			let finalBlueprint: object | undefined = undefined;
			try {
				if (configurationSource === 'blueprint-json') {
					if (blueprint) {
						finalBlueprint = JSON.parse(blueprint);
					}
				} else if (configurationSource === 'blueprint-url') {
					if (blueprintUrl) {
						finalBlueprint = await fetch(blueprintUrl).then((res) =>
							res.json()
						);
					}
				} else {
					finalBlueprint = {
						preferredVersions: {
							wp: 'latest',
							php: '7.4',
						},
						steps: [
							{
								step: 'defineWpConfigConsts',
								consts: constants,
							},
							logInUser && {
								step: 'login',
								username: 'admin',
								password: 'password',
							},
						].filter(Boolean),
					};
				}
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('Failed to parse blueprint:', e);
			}

			const configuration: {
				iframe: HTMLIFrameElement;
				remoteUrl: string;
				blueprint?: object;
			} = {
				iframe: iframeRef.current,
				remoteUrl: 'https://playground.wordpress.net/remote.html',
			};
			if (finalBlueprint) {
				configuration.blueprint = finalBlueprint;
			}

			// eslint-disable-next-line no-console
			console.log('Initializing Playground');
			const client = await startPlaygroundWeb(configuration);
			await client.isReady();
			playgroundClientRef.current = client;
			setIsPlaygroundReady(true);

			// Delay the announcement to let iframe loading announcements finish first
			setTimeout(
				() => speak(__('WordPress Playground loaded.'), 'polite'),
				500
			);

			await reinstallEditedCode();

			if (configurationSource === 'block-attributes') {
				let postId = 0;
				if (createNewPost) {
					const docroot = await client.documentRoot;
					const { text: newPostId } = await client.run({
						code: `<?php
						require("${docroot}/wp-load.php");

						$post_id = wp_insert_post([
							'post_title' => ${phpVar(createNewPostTitle)},
							'post_content' => ${phpVar(createNewPostContent)},
							'post_status' => 'publish',
							'post_type' => ${phpVar(createNewPostType)},
						]);

						echo $post_id;
					`,
					});

					setCurrentPostId(parseInt(newPostId));
					postId = parseInt(newPostId);
				}
				const redirectUrl = getLandingPageUrl(postId);
				await client.goTo(redirectUrl);
			} else if (!finalBlueprint) {
				await client.goTo('/');
			}
		}

		initPlayground();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLivePreviewActivated]);

	function getFullPageUrl(): string {
		const fullPageUrl = new URL(window.location.href);
		fullPageUrl.search = '?playground-full-page';

		const fullPageAttributes = {
			...baseAttributesForFullPageView,
			requireLivePreviewActivation: false,
			files: files.filter((f) => !isErrorLogFile(f)),
		};

		const encodedFullPageAttributes = stringToBase64(
			JSON.stringify(base64EncodeBlockAttributes(fullPageAttributes))
		);
		fullPageUrl.searchParams.append(
			'playground-attributes',
			encodedFullPageAttributes
		);

		return fullPageUrl.toString();
	}

	function getLandingPageUrl(postId: number = currentPostId): string {
		if (createNewPost && redirectToPost) {
			if (redirectToPostType === 'front') {
				return `/?p=${postId}`;
			} else if (redirectToPostType === 'admin') {
				return `/wp-admin/post.php?post=${postId}&action=edit`;
			}
		}
		return landingPageUrl;
	}

	const [transpilationFailures, setTranspilationFailures] = useState<
		TranspilationFailure[]
	>([]);

	async function reinstallEditedCode() {
		if (!playgroundClientRef.current || !codeEditor) return;

		setTranspilationFailures([]);

		const client = playgroundClientRef.current;
		let finalFiles = files;

		if (codeEditorTranspileJsx) {
			const { failures, transpiledFiles } =
				await transpilePluginFiles(finalFiles);
			if (failures.length) {
				for (const failure of failures) {
					// eslint-disable-next-line no-console
					console.error(
						`Failed to transpile ${failure.file.name}:`,
						failure.error
					);
				}
				setTranspilationFailures(failures);
				return;
			}
			finalFiles = transpiledFiles;
		}

		if (codeEditorMode === 'theme') {
			await writeThemeFiles(client, finalFiles);
		} else {
			await writePluginFiles(client, finalFiles);
		}
	}

	async function handleReRunCode() {
		if (!isLivePreviewActivated) {
			setLivePreviewActivated(true);
		} else {
			await reinstallEditedCode();
			const lastPath = await playgroundClientRef.current!.getCurrentURL();
			await playgroundClientRef.current!.goTo(getRefreshPath(lastPath));
		}
	}

	const keymapExtension = keymap.of([
		{
			key: 'Mod-s',
			run() {
				handleReRunCode();
				return true;
			},
		},
	]);

	const mainContainerClass = classNames(
		'wordpress-playground-main-container',
		{
			'is-full-page-view': inFullPageView,
		}
	);

	const contentContainerClass = classNames(
		'wordpress-playground-content-container',
		{
			'is-one-under-another': !codeEditorSideBySide,
			'is-side-by-side': codeEditorSideBySide,
		}
	);

	const activeStatusLabel = isPlaygroundReady ? __('Loaded') : __('Loading');
	const inactiveStatusLabel = __('Not Activated');
	const beforePlaygroundPreviewLabel = sprintf(
		__('Beginning of Playground Preview - %s'),
		isLivePreviewActivated ? activeStatusLabel : inactiveStatusLabel
	);

	return (
		<section
			aria-label={__('WordPress Playground')}
			className={`wp-block-wordpress-playground-playground ${mainContainerClass}`}
		>
			<div className={contentContainerClass}>
				{codeEditor && (
					<div className="code-container">
						<FileManagementModals
							ref={fileMgrRef}
							updateFile={updateFile}
							addFile={addFile}
							setActiveFileIndex={setActiveFileIndex}
							files={files}
							activeFileIndex={activeFileIndex}
						/>
						<div className="file-tabs">
							{isFilesLoading ? (
								<div className="file-tab file-tab-loading">
									<span className="spinner" />{' '}
									{__('Loading files...')}
								</div>
							) : (
								files.map((file, index) => (
									<button
										key={file.name}
										type="button"
										className={`file-tab ${
											index === activeFileIndex
												? 'file-tab-active'
												: ''
										}`}
										aria-label={
											codeEditorReadOnly ||
											isErrorLogFile(file)
												? sprintf(
														__(
															'Read-only file: %s'
														),
														file.name
													)
												: sprintf(
														__('File: %s'),
														file.name
													)
										}
										aria-current={
											index === activeFileIndex
												? 'true'
												: 'false'
										}
										onClick={() =>
											setActiveFileIndex(index)
										}
										onDoubleClick={() =>
											fileMgrRef.current?.setEditFileNameModalOpen(
												true
											)
										}
									>
										{file.remoteUrl && <IconLink />}
										{file.name}
									</button>
								))
							)}
							{showAddNewFile && (
								<button
									type="button"
									aria-label={__('Add File')}
									className="file-tab file-tab-extra"
									onClick={() =>
										fileMgrRef.current?.setNewFileModalOpen(
											true
										)
									}
								>
									<IconPlus />
								</button>
							)}
							<button
								ref={downloadButtonRef}
								type="button"
								aria-label={__('Download Code as a Zip file')}
								className="file-tab file-tab-extra"
								onClick={() => {
									if (playgroundClientRef.current) {
										downloadZippedPackage(
											playgroundClientRef.current,
											codeEditorMode
										);
									}
								}}
							>
								<IconDownload />
							</button>
						</div>
						{!dismissedExitWithKeyboardTip && (
							<button
								type="button"
								className="playground-block-exit-editor-tip"
								onClick={dismissExitWithKeyboardTip}
							>
								{__('Press ')}
								<code>{__('Esc')}</code>
								{__(', ')}
								<code>{__('Tab')}</code>
								{__(' to exit the editor. ')}
								<span className="playground-block-exit-editor-tip-dismiss-notice">
									{__('(Click to dismiss this notice.)')}
								</span>
							</button>
						)}
						<div className="code-editor-wrapper">
							<ReactCodeMirror
								ref={codeMirrorRef}
								value={activeFile?.contents || ''}
								extensions={[
									keymapExtension,
									EditorView.lineWrapping,
									...getLanguageExtensions(
										currentFileExtension
									),
								]}
								readOnly={
									codeEditorReadOnly ||
									isErrorLogFile(files[activeFileIndex])
								}
								onChange={(value) =>
									updateFile((file) => ({
										...file,
										contents: value,
									}))
								}
							/>
						</div>
						<div className="actions-bar">
							{showFileControls ? (
								<div className="file-actions">
									{activeFile &&
										!isErrorLogFile(activeFile) && (
											<button
												type="button"
												onClick={() =>
													fileMgrRef.current?.setEditFileNameModalOpen(
														true
													)
												}
												className="wordpress-playground-block-button button-non-destructive"
											>
												<IconEdit />{' '}
												{__('Edit file name')}
											</button>
										)}
									{!isErrorLogFile(activeFile) &&
										files.filter(
											(file) => !isErrorLogFile(file)
										).length > 1 && (
											<button
												type="button"
												className="wordpress-playground-block-button button-destructive"
												onClick={() => {
													setActiveFileIndex(0);
													removeFile(activeFileIndex);
												}}
											>
												<IconCancel />{' '}
												{__('Remove file')}
											</button>
										)}
								</div>
							) : (
								<div className="file-actions" />
							)}
							<button
								type="button"
								onClick={handleReRunCode}
								className="wordpress-playground-run-button playground-button playground-button-primary"
								aria-describedby={
									requireLivePreviewActivation &&
									!isLivePreviewActivated
										? runButtonDescId
										: undefined
								}
							>
								{__('Run')} <IconPlay />
							</button>
							{requireLivePreviewActivation &&
								!isLivePreviewActivated && (
									<span
										id={runButtonDescId}
										className="screen-reader-text"
									>
										{__(
											'This button runs the code in the Preview iframe. If the Preview iframe has not yet been activated, this button creates the Preview iframe which contains a full WordPress website and may be a challenge for screen readers.'
										)}
									</span>
								)}
						</div>
					</div>
				)}
				<div className="playground-container">
					{!inFullPageView && (
						<>
							<span
								className="screen-reader-text wordpress-playground-before-preview"
								tabIndex={-1}
								ref={beforePreviewRef}
							>
								{beforePlaygroundPreviewLabel}
							</span>
							<button
								type="button"
								className="screen-reader-text"
								onClick={() => {
									afterPreviewRef.current?.focus();
								}}
							>
								{__('Skip Playground Preview')}
							</button>
						</>
					)}
					{!isLivePreviewActivated && (
						<div className="playground-activation-placeholder">
							<button
								type="button"
								className="wordpress-playground-activate-button playground-button playground-button-primary"
								onClick={() => {
									setLivePreviewActivated(true);
									beforePreviewRef.current?.focus();
								}}
								aria-describedby={activateButtonDescId}
							>
								{__('Activate Live Preview')}
							</button>
							<span
								id={activateButtonDescId}
								className="screen-reader-text"
							>
								{__(
									'This button creates the Preview iframe containing a full WordPress website which may be a challenge for screen readers.'
								)}
							</span>
						</div>
					)}
					{transpilationFailures.length > 0 && (
						<div className="playground-transpilation-failures">
							<h3>{__('Transpilation Error')}</h3>
							<p>
								{__(
									'There were errors while transpiling the code. Please fix the errors and try again.'
								)}
							</p>
							<ul>
								{transpilationFailures.map(
									({ file, error }) => (
										<li key={file.name}>
											<b>{file.name}</b>
											<p>{error.message}</p>
										</li>
									)
								)}
							</ul>
						</div>
					)}
					{isLivePreviewActivated && (
						<iframe
							title={__('Live Preview in WordPress Playground')}
							key="playground-iframe"
							ref={iframeRef}
							className="playground-iframe"
						/>
					)}
					{!inFullPageView && (
						<span
							className="screen-reader-text wordpress-playground-end-of-preview"
							tabIndex={-1}
							ref={afterPreviewRef}
						>
							{__('End of Playground Preview')}
						</span>
					)}
				</div>
			</div>
			<footer className="wordpress-playground-footer">
				<a
					href="https://w.org/playground"
					className="wordpress-playground-footer__powered_by_link"
					target="_blank"
					rel="noopener noreferrer"
					aria-label={__('Powered by WordPress Playground')}
				>
					<span className="wordpress-playground-footer__powered_text">
						{__('Powered by')}
					</span>
					<span className="wordpress-playground-footer__spacing">
						&nbsp;
					</span>
					<IconWordPress className="wordpress-playground-footer__icon" />
					<span className="wordpress-playground-footer__powered_by_link-text">
						{__('WordPress Playground')}
					</span>
				</a>
				{!inFullPageView && (
					<button
						type="button"
						className="wordpress-playground-footer__full-page-link"
						onClick={() => window.open(getFullPageUrl(), '_blank')}
						aria-label={__('Open in New Tab')}
					>
						{__('Open in New Tab')}
					</button>
				)}
			</footer>
		</section>
	);
}
