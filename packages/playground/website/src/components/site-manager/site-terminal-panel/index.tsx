import { Button, TextareaControl } from '@wordpress/components';
import { joinPaths } from '@php-wasm/util';
import {
	type PlaygroundClient,
	type StepDefinition,
	type UniversalPHP,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/client';
import { useState } from 'react';
import css from './style.module.css';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

type TerminalMode = 'php' | 'wp-cli';

type TerminalEntry = {
	mode: TerminalMode;
	command: string;
	output: string;
	status: 'success' | 'error';
};

const DEFAULT_PHP_CODE = "echo get_option( 'blogname' );";
const DEFAULT_WP_CLI_COMMAND = 'wp option get blogname';

export function SiteTerminalPanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [mode, setMode] = useState<TerminalMode>('php');
	const [phpCode, setPhpCode] = useState(DEFAULT_PHP_CODE);
	const [wpCliCommand, setWpCliCommand] = useState(DEFAULT_WP_CLI_COMMAND);
	const [entries, setEntries] = useState<TerminalEntry[]>([]);
	const [isRunning, setIsRunning] = useState(false);

	const command = mode === 'php' ? phpCode : wpCliCommand;
	const canRun = !!playground && !!command.trim() && !isRunning;

	async function runCommand() {
		if (!playground || !canRun) {
			return;
		}

		setIsRunning(true);
		try {
			const output =
				mode === 'php'
					? await runPHP(playground, phpCode)
					: await runWpCli(playground, wpCliCommand);
			appendEntry({
				mode,
				command,
				output,
				status: 'success',
			});
		} catch (error) {
			appendEntry({
				mode,
				command,
				output: getErrorOutput(error),
				status: 'error',
			});
		} finally {
			setIsRunning(false);
		}
	}

	function appendEntry(entry: TerminalEntry) {
		setEntries((current) => [...current, entry]);
	}

	return (
		<div className={css.terminalPanel}>
			<div className={css.toolbar}>
				<div className={css.modeTabs} role="tablist">
					<Button
						variant={mode === 'php' ? 'primary' : 'secondary'}
						onClick={() => setMode('php')}
						aria-pressed={mode === 'php'}
					>
						PHP
					</Button>
					<Button
						variant={mode === 'wp-cli' ? 'primary' : 'secondary'}
						onClick={() => setMode('wp-cli')}
						aria-pressed={mode === 'wp-cli'}
					>
						WP-CLI
					</Button>
				</div>
				<Button
					variant="secondary"
					onClick={() => setEntries([])}
					disabled={entries.length === 0 || isRunning}
				>
					Clear
				</Button>
			</div>
			<TextareaControl
				__nextHasNoMarginBottom
				label={mode === 'php' ? 'PHP code' : 'WP-CLI command'}
				value={command}
				rows={mode === 'php' ? 12 : 3}
				className={css.commandInput}
				help={
					mode === 'php'
						? 'Runs with WordPress loaded. The opening <?php tag is optional.'
						: 'Runs through a Blueprint wp-cli step. The command must start with wp.'
				}
				onChange={(value) => {
					if (mode === 'php') {
						setPhpCode(value);
					} else {
						setWpCliCommand(value);
					}
				}}
			/>
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
			<div className={css.output} aria-live="polite">
				{entries.length === 0 ? (
					<div className={css.emptyOutput}>
						Command output will appear here.
					</div>
				) : (
					entries.map((entry, index) => (
						<div className={css.entry} key={index}>
							<div className={css.prompt}>
								<span>
									{entry.mode === 'php' ? 'php' : 'wp-cli'}$
								</span>{' '}
								{entry.command}
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
			</div>
		</div>
	);
}

async function runPHP(playground: PlaygroundClient, code: string) {
	const documentRoot = await playground.documentRoot;
	const response = await playground.run({
		code: getWordPressPHPCode(code, documentRoot),
	});
	return formatResponse(response);
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
	return formatResponseLike(wpCliOutput);
}

function getWordPressPHPCode(code: string, documentRoot: string) {
	const codeWithoutOpeningTag = code.replace(/^\s*<\?php\s*/i, '');
	const wpLoadPath = joinPaths(documentRoot, 'wp-load.php');
	return `<?php require_once ${JSON.stringify(wpLoadPath)};\n${codeWithoutOpeningTag}`;
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
		parts.push(response.errors.trimEnd());
	}
	if (response.exitCode !== 0) {
		parts.push(`Exit code: ${response.exitCode}`);
	}
	return parts.join('\n');
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
		return error.message;
	}
	return String(error);
}
