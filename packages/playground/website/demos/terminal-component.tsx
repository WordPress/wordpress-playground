import { useCallback, useEffect, useRef, useState } from 'react';
import css from './terminal.module.css';
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import type { PlaygroundClient } from '@wp-playground/client';
import { wpCLI } from '@wp-playground/client';

interface TerminalComponentProps {
	playground: PlaygroundClient;
}

/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split
 * into `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 *
 * @param command
 * @returns
 */
function splitShellCommand(command: string) {
	const MODE_NORMAL = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_NORMAL;
	let quote = '';

	const parts: string[] = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (mode === MODE_NORMAL) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				parts.push(currentPart);
				currentPart = '';
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === '\\') {
				i++;
				currentPart += command[i];
			} else if (char === quote) {
				mode = MODE_NORMAL;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart);
	}
	return parts;
}

export function TerminalComponent({ playground }: TerminalComponentProps) {
	const terminalContainer = useRef<HTMLDivElement>();
	const terminalRef = useRef<Terminal>();

	const isRunningCommand = useRef<boolean>(false);

	const history = useRef<string[]>([]);
	const currentHistoryEntry = useRef<number>(-1);
	const runCommand = useCallback(
		async (command: string) => {
			command = command.trim();
			if (command) {
				history.current.unshift(command);
			}
			currentHistoryEntry.current = -1;

			isRunningCommand.current = true;

			const args = splitShellCommand(command);
			const cmd = args.shift();

			switch (cmd) {
				case 'ls':
					// TODO:
					(
						(await playground?.listFiles(args[0] || '/')) || []
					).forEach((line: string) => {
						terminalRef.current?.writeln(line);
					});
					break;
				case 'clear':
					terminalRef.current?.clear();
					break;
				case 'cat':
					// eslint-disable-next-line no-case-declarations
					const file = await playground?.readFileAsText(args[0]);
					terminalRef.current?.writeln(file || '');
					break;

				case 'php':
					if (playground && args.length > 2) {
						if (args[0] === '-r') {
							const output = await playground.run({
								code: `<?php ${args
									.slice(1, args.length)
									.join(' ')} ?>`,
							});
							output.text.split('\n').forEach((line: string) => {
								terminalRef.current?.writeln(line);
							});
						}
					}
					break;

				case 'wp':
					if (playground) {
						let output: string;
						try {
							const response = await wpCLI(playground, {
								command: ['wp', ...args],
								wpCliPath: '/wordpress/wp-cli.phar',
							});
							output = response.text + response.errors;
						} catch (error) {
							output = (error as Error).message;
						}
						output.split('\n').forEach((line: string) => {
							terminalRef.current?.writeln(line);
						});
					}
					break;

				default:
					if (cmd?.trim()) {
						terminalRef.current?.writeln(
							`${cmd}: Command not found`
						);
					}
			}

			terminalRef.current?.write('$ ');

			isRunningCommand.current = false;
		},
		[playground]
	);

	const [counter, setCounter] = useState(0);

	useEffect(() => {
		if (!terminalContainer.current || !playground) {
			setCounter((v) => v + 1);
			return;
		}

		const term = new Terminal();
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);

		terminalRef.current = term;
		term.open(terminalContainer.current);
		fitAddon.fit();

		// On window resize, debounce fit every 300ms
		let timeout: any;
		window.addEventListener('resize', () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				fitAddon.fit();
			}, 300);
		});

		let command = '';
		// TODO: Use a nicer default font
		term.writeln(
			[
				'This is a demo of \x1b[1mWP-CLI\x1b[0m in the browser :)',
				'',
				"Here's a few useful commands to get you started:",
				'',
				' \x1b[1mwp\x1b[0m           Run WP-CLI command',
				' \x1b[1mls\x1b[0m           List files',
				' \x1b[1mcat\x1b[0m          Print file contents',
				' \x1b[1mclear\x1b[0m        Clear the screen',
				'',
			].join('\n\r')
		);

		term.writeln('Below is a simple emulated backend, try running `ls`.');
		const clearLine = () => {
			term.write('\x1b[2K\r');
		};
		const prompt = ({ newLine = true } = {}) => {
			if (newLine) {
				term.write('\r\n');
			}
			term.write('$ ');
		};
		prompt();

		term.onData((e) => {
			if (isRunningCommand.current) {
				return;
			}
			switch (e) {
				case '\u0003': // Ctrl+C
					term.write('^C');
					command = '';
					prompt();
					break;
				case '\r': // Enter
					console.log(`Sending command: ${command}`);
					term.write('\n\r');
					runCommand(command);
					command = '';
					break;
				case '\u007F': // Backspace (DEL)
					// Do not delete the prompt
					// @ts-ignore
					if (term._core.buffer.x > 2) {
						term.write('\b \b');
						if (command.length > 0) {
							command = command.substring(0, command.length - 1);
						}
					}
					break;
				default: // Print all other characters for demo
					if (
						(e >= String.fromCharCode(0x20) &&
							e <= String.fromCharCode(0x7e)) ||
						e >= '\u00a0'
					) {
						command += e;
						term.write(e);
					}
			}
		});

		term.attachCustomKeyEventHandler((arg) => {
			if (
				(arg.metaKey || arg.ctrlKey) &&
				arg.code === 'KeyV' &&
				arg.type === 'keydown'
			) {
				navigator.clipboard.readText().then((text) => {
					term.write(text);
					command += text;
				});
			} else if (
				!(arg.metaKey || arg.ctrlKey) &&
				arg.type === 'keydown'
			) {
				if (arg.code === 'ArrowUp') {
					if (
						currentHistoryEntry.current <
						history.current.length - 1
					) {
						++currentHistoryEntry.current;
						command =
							history.current[currentHistoryEntry.current] || '';
						clearLine();
						prompt({ newLine: false });
						term.write(command);
					}
				} else if (arg.code === 'ArrowDown') {
					if (currentHistoryEntry.current > 0) {
						--currentHistoryEntry.current;
						command =
							history.current[currentHistoryEntry.current] || '';
						clearLine();
						prompt({ newLine: false });
						term.write(command);
					}
				}
				/*
				Handling left/right arrows requires a bit more work
				like tracking the current line, cursor position, etc.
				Let's leave that for another day.
				else if (arg.code === 'ArrowLeft') {
					// @ts-ignore
					term.write(`${String.fromCharCode(27)}[1D`);
				} else if (arg.code === 'ArrowRight') {
					term.write(`${String.fromCharCode(27)}[1C`);
				}
				*/
			}
			return true;
		});

		return () => {
			term.dispose();
		};
	}, [playground, runCommand, counter]);

	// @ts-ignore
	return <div className={css.terminal} ref={terminalContainer} />;
}
