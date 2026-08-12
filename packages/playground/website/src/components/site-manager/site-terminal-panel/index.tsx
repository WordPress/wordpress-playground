import { Button, Icon, TextareaControl } from '@wordpress/components';
import { joinPaths } from '@php-wasm/util';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import {
	type PlaygroundClient,
	type UniversalPHP,
	defaultWpCliPath,
	defaultWpCliResource,
	phpVar,
	wpCLI,
} from '@wp-playground/client';
import { useEffect, useRef, useState } from 'react';
import { check, chevronLeft, chevronRight, copySmall } from '@wordpress/icons';
import { InlineProgress } from '../../pane-loading';
import css from './style.module.css';
import { getTerminalErrorMessage } from './terminal-error';
import {
	appendEntryToHistory,
	loadTerminalHistory,
	saveTerminalHistory,
} from './terminal-history';
import type { TerminalHistoryEntry } from './terminal-history';
import { getWpCliCommandError, stripWpPrefix } from './wp-cli-command';
import { formatWpCliOutput } from './wp-cli-output';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

type TerminalMode = 'php' | 'wp-cli';

type TerminalEntry = TerminalHistoryEntry;

const PHP_INCOMPLETE_INPUT_MARKER = '__PLAYGROUND_PHP_INCOMPLETE_INPUT__';
const WORDPRESS_PHP_DOCS_URL = 'https://developer.wordpress.org/reference/';
const PHP_SNIPPETS = [
	{
		label: 'Site title',
		code: "echo get_option( 'blogname' );",
	},
	{
		label: 'Current user',
		code: 'print_r( wp_get_current_user()->data );',
	},
	{
		label: 'List posts',
		code: `foreach ( get_posts() as $post ) {
	echo $post->post_title . "\\n";
}`,
	},
	{
		label: 'Create post',
		code: `$post_id = wp_insert_post( [
	'post_title' => 'Hello from Playground',
	'post_status' => 'publish',
] );
echo "Created post {$post_id}\\n";`,
	},
	{
		label: 'Active plugins',
		code: "print_r( get_option( 'active_plugins' ) );",
	},
];
const WP_CLI_SUGGESTIONS = [
	{
		command: 'wp option get blogname',
		description: 'Show the site title.',
	},
	{
		command: 'wp option update blogname "My Playground"',
		description: 'Change the site title.',
	},
	{
		command: 'wp plugin list',
		description: 'List installed plugins.',
	},
	{
		command: 'wp plugin activate gutenberg',
		description: 'Activate a plugin.',
	},
	{
		command: 'wp theme list',
		description: 'List installed themes.',
	},
	{
		command: 'wp theme activate twentytwentyfour',
		description: 'Activate a theme.',
	},
	{
		command: 'wp post list',
		description: 'List posts.',
	},
	{
		command: 'wp post create --post_title="Hello" --post_status=publish',
		description: 'Create a post.',
	},
	{
		command: 'wp user list',
		description: 'List users.',
	},
	{
		command: 'wp rewrite flush',
		description: 'Flush rewrite rules.',
	},
	{
		command: 'wp search-replace old.example new.example --dry-run',
		description: 'Preview a search and replace.',
	},
	{
		command: 'wp cache flush',
		description: 'Clear the object cache.',
	},
];

export function SiteTerminalPanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [mode, setMode] = useState<TerminalMode>('php');
	const [initialHistory] = useState(loadTerminalHistory);
	const [phpCode, setPhpCode] = useState(
		initialHistory.php.at(-1)?.command || ''
	);
	const [wpCliCommand, setWpCliCommand] = useState(
		initialHistory['wp-cli'].at(-1)?.command || ''
	);
	const [entriesByMode, setEntriesByMode] =
		useState<Record<TerminalMode, TerminalEntry[]>>(initialHistory);
	const [activeEntryIndexByMode, setActiveEntryIndexByMode] = useState<
		Record<TerminalMode, number>
	>({
		php: initialHistory.php.length - 1,
		'wp-cli': initialHistory['wp-cli'].length - 1,
	});
	const [isRunning, setIsRunning] = useState(false);
	const [isAwaitingMoreInput, setIsAwaitingMoreInput] = useState(false);
	const [copiedOutput, copyOutput] = useCopyToClipboard();
	const [isWpCliSuggestionsOpen, setIsWpCliSuggestionsOpen] = useState(false);
	const [activeWpCliSuggestion, setActiveWpCliSuggestion] = useState(-1);
	const wpCliInputRef = useRef<HTMLInputElement>(null);
	const wpCliComboboxRef = useRef<HTMLDivElement>(null);

	const command = mode === 'php' ? phpCode : wpCliCommand;
	const entries = entriesByMode[mode];
	const activeEntryIndex = activeEntryIndexByMode[mode];
	const activeEntry =
		activeEntryIndex >= 0 ? entries[activeEntryIndex] : undefined;
	const canRun = !!playground && !!command.trim() && !isRunning;
	const canNavigatePrevious = activeEntryIndex > 0;
	const canNavigateNext =
		activeEntryIndex >= 0 && activeEntryIndex < entries.length - 1;
	const wpCliSuggestions = getWpCliSuggestions(wpCliCommand);

	async function runCommand() {
		if (!playground || !canRun) {
			return;
		}

		/**
		 * The runner accepts commands with or without the executable. Normalize
		 * pasted `wp ...` commands so they do not run as `wp wp ...`.
		 */
		const submittedCommand =
			mode === 'wp-cli' ? stripWpPrefix(wpCliCommand.trim()) : phpCode;

		if (mode === 'wp-cli') {
			closeWpCliSuggestions();
		}
		setIsRunning(true);
		setIsAwaitingMoreInput(false);
		const startedAt = performance.now();
		try {
			const wpCliCommandError =
				mode === 'wp-cli'
					? getWpCliCommandError(`wp ${submittedCommand}`)
					: undefined;
			if (wpCliCommandError) {
				throw new Error(wpCliCommandError);
			}
			let output: string;
			if (mode === 'php') {
				const result = await runPHP(playground, submittedCommand);
				if (result.incomplete) {
					setPhpCode(`${submittedCommand}\n`);
					setIsAwaitingMoreInput(true);
					return;
				}
				output = result.output;
			} else {
				output = await runWpCli(playground, `wp ${submittedCommand}`);
			}
			appendEntry(mode, {
				command: getHistoryCommand(mode, submittedCommand),
				output,
				status: 'success',
				durationMs: performance.now() - startedAt,
			});
		} catch (error) {
			appendEntry(mode, {
				command: getHistoryCommand(mode, submittedCommand),
				output: getErrorOutput(error, mode),
				status: 'error',
				durationMs: performance.now() - startedAt,
			});
		} finally {
			setIsRunning(false);
		}
	}

	function appendEntry(entryMode: TerminalMode, entry: TerminalEntry) {
		setEntriesByMode((current) => {
			const next = appendEntryToHistory(current, entryMode, entry);
			saveTerminalHistory(next);
			setActiveEntryIndexByMode((currentIndexes) => ({
				...currentIndexes,
				[entryMode]: next[entryMode].length - 1,
			}));
			return next;
		});
	}

	function setCurrentCommand(value: string) {
		if (mode === 'php') {
			setPhpCode(value);
		} else {
			setWpCliCommand(value);
		}
	}

	function updateCurrentCommand(value: string) {
		setCurrentCommand(value);
	}

	function updateWpCliCommand(value: string) {
		setWpCliCommand(value);
		setActiveWpCliSuggestion(-1);
		setIsWpCliSuggestionsOpen(true);
	}

	function selectWpCliSuggestion(commandSuggestion: string) {
		setWpCliCommand(commandSuggestion);
		setActiveWpCliSuggestion(-1);
		setIsWpCliSuggestionsOpen(false);
		wpCliInputRef.current?.focus();
	}

	function selectPhpSnippet(code: string) {
		setPhpCode(code);
	}

	function navigateRunHistory(direction: 'previous' | 'next') {
		const nextIndex =
			direction === 'previous'
				? activeEntryIndex - 1
				: activeEntryIndex + 1;
		const nextEntry = entries[nextIndex];
		if (!nextEntry || !confirmReplaceModifiedInput()) {
			return;
		}

		setActiveEntryIndexByMode((current) => ({
			...current,
			[mode]: nextIndex,
		}));
		setCurrentCommand(nextEntry.command);
		setIsAwaitingMoreInput(false);
		closeWpCliSuggestions();
	}

	function confirmReplaceModifiedInput() {
		if (!activeEntry || command === activeEntry.command) {
			return true;
		}
		return window.confirm(
			'You have edits that are not in history. Discard them and open another history entry?'
		);
	}

	function closeWpCliSuggestions() {
		setIsWpCliSuggestionsOpen(false);
		setActiveWpCliSuggestion(-1);
	}

	function handleWpCliKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		const suggestionsCount = wpCliSuggestions.length;
		if (event.key === 'ArrowDown' && suggestionsCount > 0) {
			event.preventDefault();
			setIsWpCliSuggestionsOpen(true);
			setActiveWpCliSuggestion((index) => (index + 1) % suggestionsCount);
		} else if (event.key === 'ArrowUp' && suggestionsCount > 0) {
			event.preventDefault();
			setIsWpCliSuggestionsOpen(true);
			setActiveWpCliSuggestion((index) =>
				index <= 0 ? suggestionsCount - 1 : index - 1
			);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (isWpCliSuggestionsOpen && activeWpCliSuggestion >= 0) {
				selectWpCliSuggestion(
					wpCliSuggestions[activeWpCliSuggestion].command
				);
				return;
			}
			runCommand();
		} else if (event.key === 'Escape') {
			closeWpCliSuggestions();
		}
	}

	function handleWpCliBlur() {
		setTimeout(() => {
			if (!wpCliComboboxRef.current?.contains(document.activeElement)) {
				closeWpCliSuggestions();
			}
		}, 0);
	}

	function handlePhpKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (isRunShortcut(event)) {
			event.preventDefault();
			runCommand();
		}
	}

	function clearOutput() {
		setEntriesByMode((current) => {
			const next = {
				...current,
				[mode]: [],
			};
			saveTerminalHistory(next);
			return next;
		});
		setActiveEntryIndexByMode((current) => ({
			...current,
			[mode]: -1,
		}));
	}

	return (
		<div className={css.terminalPanel}>
			<div className={css.toolbar}>
				<div className={css.modeTabs} aria-label="Terminal mode">
					<Button
						className={`${css.modeTab} ${
							mode === 'php' ? css.modeTabActive : ''
						}`}
						onClick={() => setMode('php')}
						aria-pressed={mode === 'php'}
					>
						PHP
					</Button>
					<Button
						className={`${css.modeTab} ${
							mode === 'wp-cli' ? css.modeTabActive : ''
						}`}
						onClick={() => setMode('wp-cli')}
						aria-pressed={mode === 'wp-cli'}
					>
						WP-CLI
					</Button>
				</div>
				<Button
					variant="secondary"
					onClick={clearOutput}
					disabled={entries.length === 0 || isRunning}
				>
					Clear
				</Button>
			</div>
			<div className={css.runner}>
				{mode === 'php' ? (
					<>
						<div className={css.phpSnippets}>
							{PHP_SNIPPETS.map((snippet) => (
								<Button
									key={snippet.label}
									size="compact"
									variant="tertiary"
									onClick={() =>
										selectPhpSnippet(snippet.code)
									}
								>
									{snippet.label}
								</Button>
							))}
							<a
								className={css.phpDocsLink}
								href={WORDPRESS_PHP_DOCS_URL}
								target="_blank"
								rel="noreferrer"
							>
								WordPress PHP reference
							</a>
						</div>
						<TextareaControl
							__nextHasNoMarginBottom
							hideLabelFromVision
							label="PHP code"
							value={phpCode}
							disabled={!playground}
							rows={Math.max(12, phpCode.split('\n').length)}
							className={css.commandEditor}
							placeholder="echo get_option( 'blogname' );"
							onChange={updateCurrentCommand}
							onKeyDown={handlePhpKeyDown}
						/>
					</>
				) : (
					<div className={css.wpCliCombobox} ref={wpCliComboboxRef}>
						<input
							ref={wpCliInputRef}
							className={css.wpCliInput}
							type="text"
							value={wpCliCommand}
							disabled={!playground}
							placeholder="wp option get blogname"
							aria-label="WP-CLI command"
							autoComplete="off"
							role="combobox"
							aria-autocomplete="list"
							aria-haspopup="listbox"
							aria-expanded={isWpCliSuggestionsOpen}
							aria-controls={
								isWpCliSuggestionsOpen
									? 'wp-cli-command-suggestions'
									: undefined
							}
							aria-activedescendant={
								isWpCliSuggestionsOpen &&
								activeWpCliSuggestion >= 0
									? `wp-cli-command-suggestion-${activeWpCliSuggestion}`
									: undefined
							}
							onChange={(event) =>
								updateWpCliCommand(event.target.value)
							}
							onFocus={() => setIsWpCliSuggestionsOpen(true)}
							onBlur={handleWpCliBlur}
							onKeyDown={handleWpCliKeyDown}
						/>
						{isWpCliSuggestionsOpen &&
							wpCliSuggestions.length > 0 && (
								<ul
									id="wp-cli-command-suggestions"
									role="listbox"
									className={css.wpCliSuggestions}
								>
									{wpCliSuggestions.map(
										(suggestion, index) => (
											<li
												key={suggestion.command}
												id={`wp-cli-command-suggestion-${index}`}
												role="option"
												aria-selected={
													index ===
													activeWpCliSuggestion
												}
												className={
													index ===
													activeWpCliSuggestion
														? `${css.wpCliSuggestion} ${css.wpCliSuggestionActive}`
														: css.wpCliSuggestion
												}
												onMouseDown={(event) =>
													event.preventDefault()
												}
												onMouseEnter={() =>
													setActiveWpCliSuggestion(
														index
													)
												}
												onClick={() =>
													selectWpCliSuggestion(
														suggestion.command
													)
												}
											>
												<span
													className={
														css.wpCliSuggestionCommand
													}
												>
													{suggestion.command}
												</span>
												<span
													className={
														css.wpCliSuggestionDescription
													}
												>
													{suggestion.description}
												</span>
											</li>
										)
									)}
								</ul>
							)}
					</div>
				)}
				<div className={css.actions}>
					<Button
						variant="primary"
						onClick={runCommand}
						disabled={!canRun}
						isBusy={isRunning}
					>
						Run
					</Button>
				</div>
				<div className={css.result} aria-live="polite">
					{!playground ? (
						<InlineProgress
							message={`WordPress is still loading. The ${mode === 'php' ? 'PHP' : 'WP-CLI'} runner will be ready in a moment.`}
						/>
					) : activeEntry ? (
						<>
							<div className={css.resultHeader}>
								<span>
									Result {activeEntryIndex + 1} of{' '}
									{entries.length}
								</span>
								<div className={css.resultActions}>
									<Button
										className={css.historyButton}
										size="compact"
										variant="tertiary"
										aria-label="Previous result"
										title="Previous result"
										disabled={!canNavigatePrevious}
										onClick={() =>
											navigateRunHistory('previous')
										}
									>
										<Icon icon={chevronLeft} size={18} />
									</Button>
									<Button
										className={css.historyButton}
										size="compact"
										variant="tertiary"
										aria-label="Next result"
										title="Next result"
										disabled={!canNavigateNext}
										onClick={() =>
											navigateRunHistory('next')
										}
									>
										<Icon icon={chevronRight} size={18} />
									</Button>
									<span
										className={css.executionTime}
										title="Execution time"
									>
										{formatExecutionTime(
											activeEntry.durationMs
										)}
									</span>
									<Button
										className={css.copyResult}
										size="compact"
										variant="tertiary"
										aria-label="Copy result"
										title="Copy result"
										onClick={() =>
											copyOutput(
												getEntryDisplayOutput(
													activeEntry
												)
											)
										}
									>
										<Icon
											icon={
												copiedOutput ? check : copySmall
											}
											size={18}
										/>
									</Button>
								</div>
							</div>
							<pre
								className={
									activeEntry.status === 'error'
										? css.errorOutput
										: undefined
								}
							>
								{getEntryDisplayOutput(activeEntry)}
							</pre>
						</>
					) : (
						<div className={css.emptyOutput}>
							Run{' '}
							{mode === 'php' ? 'PHP code' : 'a WP-CLI command'}{' '}
							to see the result.
						</div>
					)}
				</div>
				{mode === 'php' && isAwaitingMoreInput && (
					<div className={css.continuationHint}>
						Incomplete PHP code. Keep typing to finish the
						statement, then run it again.
					</div>
				)}
			</div>
		</div>
	);
}

async function runPHP(playground: PlaygroundClient, code: string) {
	const documentRoot = await playground.documentRoot;
	const response = await playground.run({
		code: getWordPressPHPCode(code, documentRoot),
	});
	const incomplete = response.errors.includes(PHP_INCOMPLETE_INPUT_MARKER);
	return {
		incomplete,
		output: formatResponse({
			text: response.text,
			errors: response.errors
				.replace(PHP_INCOMPLETE_INPUT_MARKER, '')
				.trim(),
			exitCode: response.exitCode,
		}),
	};
}

/**
 * Runs the wp-cli step handler directly instead of going through the Blueprint
 * runner, which would navigate the site to its landing page after every command.
 */
async function runWpCli(playground: PlaygroundClient, command: string) {
	await installWpCli(playground);
	const response = await wpCLI(playground as UniversalPHP, { command });
	return formatWpCliOutput(formatResponseLike(response));
}

async function installWpCli(playground: PlaygroundClient) {
	if (await playground.fileExists(defaultWpCliPath)) {
		return;
	}

	const response = await fetchWithCorsProxy(
		defaultWpCliResource.url,
		undefined,
		corsProxyUrl,
		await playground.absoluteUrl
	);
	if (!response.ok) {
		throw new Error(
			`Could not download WP-CLI from ${defaultWpCliResource.url}.`
		);
	}
	await playground.writeFile(
		defaultWpCliPath,
		new Uint8Array(await response.arrayBuffer())
	);
}

function getWordPressPHPCode(code: string, documentRoot: string) {
	const codeWithoutOpeningTag = code.replace(/^\s*<\?php\s*/i, '');
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	return `<?php
require_once ${phpVar(wpLoadPath)};
(function () {
	$playground_repl_has_error_handler = false;
	try {
		set_error_handler(function ($severity, $message) {
			file_put_contents(
				'php://stderr',
				"Warning: {$message}\\n",
				FILE_APPEND
			);
			return true;
		});
		$playground_repl_has_error_handler = true;
		eval(${phpVar(codeWithoutOpeningTag)});
	} catch (Throwable $playground_repl_error) {
		if (
			$playground_repl_error instanceof ParseError &&
			(
				strpos(
					$playground_repl_error->getMessage(),
					'unexpected end of file'
				) !== false ||
				strpos($playground_repl_error->getMessage(), 'Unclosed') === 0
			)
		) {
			file_put_contents(
				'php://stderr',
				${phpVar(PHP_INCOMPLETE_INPUT_MARKER)},
				FILE_APPEND
			);
		} else {
			file_put_contents(
				'php://stderr',
				get_class($playground_repl_error) . ': ' .
				$playground_repl_error->getMessage() . "\\n",
				FILE_APPEND
			);
		}
	} finally {
		if ($playground_repl_has_error_handler) {
			restore_error_handler();
		}
	}
})();`;
}

function formatResponse(response: {
	text: string;
	errors: string;
	exitCode: number;
}) {
	const parts = [];
	if (response.text) {
		parts.push(response.text.trimEnd());
	}
	if (response.errors) {
		parts.push(getTerminalErrorMessage(response.errors.trimEnd()));
	}
	if (response.exitCode !== 0) {
		parts.push(`Exit code: ${response.exitCode}`);
	}
	return parts.join('\n');
}

function formatExecutionTime(durationMs: number) {
	if (durationMs < 1000) {
		return `${Math.round(durationMs)} ms`;
	}
	return `${(durationMs / 1000).toFixed(2)} s`;
}

function getWpCliSuggestions(input: string) {
	const normalizedInput = stripWpPrefix(input.trim()).toLowerCase();
	if (!normalizedInput) {
		return WP_CLI_SUGGESTIONS;
	}
	return WP_CLI_SUGGESTIONS.filter((suggestion) =>
		stripWpPrefix(suggestion.command)
			.toLowerCase()
			.includes(normalizedInput)
	);
}

function getHistoryCommand(mode: TerminalMode, command: string) {
	return mode === 'wp-cli' ? `wp ${command}` : command;
}

function getEntryDisplayOutput(entry: TerminalEntry) {
	return entry.output || '(no output)';
}

function isRunShortcut(event: React.KeyboardEvent) {
	return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

function useCopyToClipboard(): [boolean, (text: string) => void] {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<number>();
	useEffect(() => () => window.clearTimeout(timerRef.current), []);
	const copy = (text: string) => {
		void navigator.clipboard?.writeText(text).then(
			() => {
				setCopied(true);
				window.clearTimeout(timerRef.current);
				timerRef.current = window.setTimeout(
					() => setCopied(false),
					1600
				);
			},
			() => {}
		);
	};
	return [copied, copy];
}

/**
 * `text` is a prototype getter on PHPResponse, so it is missing from responses
 * that crossed the worker boundary as plain structured-clone data. Decode the
 * bytes instead of relying on it.
 */
function formatResponseLike(response: unknown) {
	if (!response || typeof response !== 'object') {
		return '';
	}

	const { text, bytes, errors, exitCode } = response as {
		text?: unknown;
		bytes?: unknown;
		errors?: unknown;
		exitCode?: unknown;
	};
	if (typeof errors !== 'string' || typeof exitCode !== 'number') {
		return '';
	}

	return formatResponse({
		text: typeof text === 'string' ? text : decodeBytes(bytes),
		errors,
		exitCode,
	});
}

function decodeBytes(bytes: unknown) {
	if (bytes instanceof ArrayBuffer) {
		return new TextDecoder().decode(bytes);
	}

	if (ArrayBuffer.isView(bytes)) {
		return new TextDecoder().decode(
			new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
		);
	}

	return '';
}

function getErrorOutput(error: unknown, mode: TerminalMode) {
	const output = getErrorText(error);
	return mode === 'wp-cli' ? formatWpCliOutput(output) : output;
}

function getErrorText(error: unknown) {
	const response =
		typeof error === 'object' && error && 'response' in error
			? (error as { response?: unknown }).response
			: undefined;

	const responseOutput = formatResponseLike(response);
	if (responseOutput) {
		return responseOutput;
	}

	if (error instanceof Error) {
		return getTerminalErrorMessage(error.message);
	}
	return String(error);
}
