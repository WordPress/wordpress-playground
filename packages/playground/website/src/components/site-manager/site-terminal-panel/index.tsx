import { Button, TextareaControl } from '@wordpress/components';
import { joinPaths } from '@php-wasm/util';
import {
	type PlaygroundClient,
	type StepDefinition,
	type UniversalPHP,
	compileBlueprintV1,
	phpVar,
	runBlueprintV1Steps,
} from '@wp-playground/client';
import { useEffect, useRef, useState } from 'react';
import { InlineProgress } from '../../pane-loading';
import css from './style.module.css';
import { getTerminalErrorMessage } from './terminal-error';
import {
	addCommandToHistory,
	loadTerminalHistory,
	saveTerminalHistory,
} from './terminal-history';
import { getWpCliCommandError } from './wp-cli-command';
import { formatWpCliOutput } from './wp-cli-output';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

type TerminalMode = 'php' | 'wp-cli';

type TerminalEntry = {
	mode: TerminalMode;
	command: string;
	output: string;
	status: 'success' | 'error';
	durationMs: number;
};

const PHP_SESSION_STATE_PATH = '/tmp/playground-terminal-php-session';
const PHP_INCOMPLETE_INPUT_MARKER = '__PLAYGROUND_PHP_INCOMPLETE_INPUT__';

export function SiteTerminalPanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [mode, setMode] = useState<TerminalMode>('php');
	const [phpCode, setPhpCode] = useState('');
	const [wpCliCommand, setWpCliCommand] = useState('');
	const [entriesByMode, setEntriesByMode] = useState<
		Record<TerminalMode, TerminalEntry[]>
	>({
		php: [],
		'wp-cli': [],
	});
	const [isRunning, setIsRunning] = useState(false);
	const [commandHistory, setCommandHistory] = useState(loadTerminalHistory);
	const historyPosition = useRef<Record<TerminalMode, number>>({
		php: -1,
		'wp-cli': -1,
	});
	const draftBeforeHistory = useRef<Record<TerminalMode, string>>({
		php: '',
		'wp-cli': '',
	});
	const outputRef = useRef<HTMLDivElement>(null);

	const command = mode === 'php' ? phpCode : wpCliCommand;
	const entries = entriesByMode[mode];
	const canRun = !!playground && !!command.trim() && !isRunning;

	useEffect(() => {
		outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
	}, [entries, isRunning]);

	async function runCommand() {
		if (!playground || !canRun) {
			return;
		}

		setIsRunning(true);
		const startedAt = performance.now();
		try {
			const wpCliCommandError =
				mode === 'wp-cli'
					? getWpCliCommandError(`wp ${wpCliCommand}`)
					: undefined;
			if (wpCliCommandError) {
				throw new Error(wpCliCommandError);
			}
			let output: string;
			if (mode === 'php') {
				const result = await runPHP(playground, phpCode);
				if (result.incomplete) {
					setPhpCode(`${phpCode}\n`);
					return;
				}
				output = result.output;
			} else {
				output = await runWpCli(playground, `wp ${wpCliCommand}`);
			}
			recordCommand(mode, command);
			appendEntry({
				mode,
				command,
				output,
				status: 'success',
				durationMs: performance.now() - startedAt,
			});
			setCurrentCommand('');
		} catch (error) {
			recordCommand(mode, command);
			appendEntry({
				mode,
				command,
				output: getErrorOutput(error),
				status: 'error',
				durationMs: performance.now() - startedAt,
			});
		} finally {
			setIsRunning(false);
		}
	}

	function appendEntry(entry: TerminalEntry) {
		setEntriesByMode((current) => ({
			...current,
			[entry.mode]: [...current[entry.mode], entry],
		}));
	}

	function recordCommand(commandMode: TerminalMode, value: string) {
		setCommandHistory((current) => {
			const next = addCommandToHistory(current, commandMode, value);
			saveTerminalHistory(next);
			return next;
		});
		historyPosition.current[commandMode] = -1;
	}

	function setCurrentCommand(value: string) {
		if (mode === 'php') {
			setPhpCode(value);
		} else {
			setWpCliCommand(value);
		}
	}

	function updateCurrentCommand(value: string) {
		historyPosition.current[mode] = -1;
		draftBeforeHistory.current[mode] = value;
		setCurrentCommand(value);
	}

	function navigateHistory(direction: 'older' | 'newer') {
		const history = commandHistory[mode];
		if (history.length === 0) {
			return;
		}

		const currentPosition = historyPosition.current[mode];
		if (direction === 'older') {
			if (currentPosition === -1) {
				draftBeforeHistory.current[mode] = command;
			}
			const nextPosition = Math.min(
				currentPosition + 1,
				history.length - 1
			);
			historyPosition.current[mode] = nextPosition;
			setCurrentCommand(history[nextPosition]);
			return;
		}

		if (currentPosition <= 0) {
			historyPosition.current[mode] = -1;
			setCurrentCommand(draftBeforeHistory.current[mode]);
			return;
		}

		const nextPosition = currentPosition - 1;
		historyPosition.current[mode] = nextPosition;
		setCurrentCommand(history[nextPosition]);
	}

	function clearOutput() {
		setEntriesByMode((current) => ({
			...current,
			[mode]: [],
		}));
	}

	return (
		<div className={css.terminalPanel}>
			<div className={css.toolbar}>
				<div
					className={css.modeTabs}
					role="tablist"
					aria-label="Terminal mode"
				>
					<Button
						className={`${css.modeTab} ${
							mode === 'php' ? css.modeTabActive : ''
						}`}
						onClick={() => setMode('php')}
						role="tab"
						aria-selected={mode === 'php'}
						aria-controls="terminal-session"
					>
						PHP
					</Button>
					<Button
						className={`${css.modeTab} ${
							mode === 'wp-cli' ? css.modeTabActive : ''
						}`}
						onClick={() => setMode('wp-cli')}
						role="tab"
						aria-selected={mode === 'wp-cli'}
						aria-controls="terminal-session"
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
			<div
				id="terminal-session"
				className={css.output}
				role="tabpanel"
				aria-live="polite"
				ref={outputRef}
			>
				{!playground ? (
					<InlineProgress message="WordPress is still loading. The terminal will be ready in a moment." />
				) : entries.length === 0 ? (
					<div className={css.emptyOutput}>
						{mode === 'php'
							? 'PHP session ready. WordPress is loaded.'
							: 'WP-CLI session ready.'}
					</div>
				) : (
					entries.map((entry, index) => (
						<div className={css.entry} key={index}>
							<div className={css.entryHeader}>
								<div className={css.prompt}>
									<span>
										{entry.mode === 'php'
											? 'php >'
											: '$ wp'}
									</span>{' '}
									{entry.command}
								</div>
								<span
									className={css.executionTime}
									title="Execution time"
								>
									{formatExecutionTime(entry.durationMs)}
								</span>
							</div>
							<pre
								className={
									entry.status === 'error'
										? css.errorOutput
										: undefined
								}
							>
								{entry.output || '(no output)'}
							</pre>
						</div>
					))
				)}
				<div className={css.activePrompt}>
					<span className={css.promptLabel}>
						{mode === 'php' ? 'php >' : '$ wp'}
					</span>
					<TextareaControl
						__nextHasNoMarginBottom
						hideLabelFromVision
						label={mode === 'php' ? 'PHP code' : 'WP-CLI command'}
						value={command}
						disabled={!playground}
						rows={Math.max(1, command.split('\n').length)}
						className={css.commandInput}
						placeholder={
							mode === 'php'
								? "echo get_option( 'blogname' );"
								: 'option get blogname'
						}
						onChange={updateCurrentCommand}
						onKeyDown={(event) => {
							if (event.key === 'ArrowUp') {
								event.preventDefault();
								navigateHistory('older');
							} else if (event.key === 'ArrowDown') {
								event.preventDefault();
								navigateHistory('newer');
							} else if (
								event.key === 'Enter' &&
								!event.shiftKey
							) {
								event.preventDefault();
								runCommand();
							}
						}}
					/>
					<Button
						variant="primary"
						onClick={runCommand}
						disabled={!canRun}
						isBusy={isRunning}
					>
						Run
					</Button>
				</div>
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

async function runWpCli(playground: PlaygroundClient, command: string) {
	let wpCliOutput: unknown;
	const steps: StepDefinition[] = [
		{
			step: 'wp-cli',
			command,
		},
	];
	const blueprint = await compileBlueprintV1(
		{
			extraLibraries: ['wp-cli'],
			steps,
		},
		{
			corsProxy: corsProxyUrl,
			onStepCompleted: (output, step) => {
				if (step.step === 'wp-cli') {
					wpCliOutput = output;
				}
			},
		}
	);
	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
	return formatWpCliOutput(formatResponseLike(wpCliOutput));
}

function getWordPressPHPCode(code: string, documentRoot: string) {
	const codeWithoutOpeningTag = code.replace(/^\s*<\?php\s*/i, '');
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	return `<?php
require_once ${phpVar(wpLoadPath)};
(function () {
	$playground_repl_has_error_handler = false;
	try {
		$playground_repl_state = @unserialize(
			@file_get_contents(${phpVar(PHP_SESSION_STATE_PATH)})
		);
		if (is_array($playground_repl_state)) {
			extract($playground_repl_state);
		}
		unset($playground_repl_state);

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
		$playground_repl_state = get_defined_vars();
		unset($playground_repl_state['playground_repl_state']);
		unset($playground_repl_state['playground_repl_error']);
		unset($playground_repl_state['playground_repl_has_error_handler']);
		try {
			file_put_contents(
				${phpVar(PHP_SESSION_STATE_PATH)},
				serialize($playground_repl_state)
			);
		} catch (Throwable $playground_repl_error) {
			file_put_contents(
				'php://stderr',
				'Could not save the PHP session: ' .
				$playground_repl_error->getMessage() . "\\n",
				FILE_APPEND
			);
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

function formatResponseLike(response: unknown) {
	if (
		response &&
		typeof response === 'object' &&
		'text' in response &&
		'errors' in response &&
		'exitCode' in response
	) {
		return formatResponse(
			response as { text: string; errors: string; exitCode: number }
		);
	}
	return '';
}

function getErrorOutput(error: unknown) {
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
