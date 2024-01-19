import { useCallback, useEffect, useRef, useState } from 'react';
import css from './terminal.module.css';
import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { PlaygroundClient } from '@wp-playground/client';

interface TerminalComponentProps {
	playground: PlaygroundClient;
}

const COLS = 140;
const ROWS = 38;

export function TerminalComponent({ playground }: TerminalComponentProps) {
	const terminalContainer = useRef<HTMLDivElement>();
	const terminalRef = useRef<Terminal>();

	const isRunningCommand = useRef<boolean>(false);

	const runCommand = useCallback(
		async (command: string) => {
			isRunningCommand.current = true;

			const args = command.split(' ');
			const cmd = args.shift();

			switch (cmd) {
				case 'ls':
					// TODO:
					(
						(await playground?.listFiles(args[0] || '/')) || []
					).forEach((line) => {
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
							output.text.split('\n').forEach((line) => {
								terminalRef.current?.writeln(line);
							});
						}
					}
					break;

				case 'wp':
					if (playground) {
						const wpCliArgs = args.map(
							(arg) => `"${arg.replaceAll('"', '\\"')}",`
						);

						await playground?.writeFile('/tmp/stdout', '');
						await playground?.writeFile('/tmp/stderror', '');
						await playground?.writeFile(
							'/wordpress/run-cli.php',
							`<?php
            $GLOBALS['argv'] = [
              "/wordpress/wp-cli.phar",
              "--path=/wordpress",
              ${wpCliArgs.join('\n')}
            ];

            define('STDIN', fopen('php://stdin', 'rb'));
            define('STDOUT', fopen('php://stdout', 'wb'));
            define('STDERR', fopen('/tmp/stderr', 'wb'));

            require( "/wordpress/wp-cli.phar" );
            `
						);

						const output = await playground.run({
							scriptPath: '/wordpress/run-cli.php',
						});

						const stderr = await playground?.readFileAsText(
							'/tmp/stderr'
						);
						stderr.split('\n').forEach((line) => {
							if (line.includes('Warning')) {
								return;
							}
							terminalRef.current?.writeln(line);
						});

						output.text
							.split('\n')
							.slice(1, output.text.length)
							.forEach((line) => {
								if (
									line.includes('Warning') ||
									line.includes('<br />')
								) {
									return;
								}
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

	useEffect(() => {
		playground.setSpawnHandler(
			((command: string, processApi: any) => {
				if (command.startsWith('/usr/bin/env stty size ')) {
					// These numbers are hardcoded because this
					// spawnHandler is transmitted as a string to
					// the PHP backend and has no access to local
					// scope. It would be nice to find a way to
					// transfer / proxy a live object instead.
					// @TODO: Do not hardcode this
					processApi.stdout(`18 140`);
					processApi.exit(0);
				} else if (command.startsWith('less')) {
					processApi.on('stdin', (data: Uint8Array) => {
						processApi.stdout(data);
					});
					processApi.flushStdin();
					processApi.exit(0);
				}
			}).toString()
		);
	}, []);

	const [counter, setCounter] = useState(0);

	useEffect(() => {
		if (!terminalContainer.current || !playground) {
			setCounter((v) => v + 1);
			return;
		}

		const term = new Terminal({ convertEol: true, cols: COLS, rows: ROWS });
		terminalRef.current = term;

		term.open(terminalContainer.current);

		let command = '';
		// TODO: Use a nicer default font
		term.writeln(
			[
				'This is a demo of \x1b[1mwp-cli\x1b[0m in the browser :)',
				'',
				"Here's a few useful commands to get you started:",
				'',
				' \x1b[1mwp\x1b[0m           Run WP CLI command',
				' \x1b[1mphp\x1b[0m          Run PHP code',
				' \x1b[1mls\x1b[0m           List files',
				' \x1b[1mcat\x1b[0m          Print file contents',
				' \x1b[1mclear\x1b[0m        Clear the screen',
				'',
			].join('\n\r')
		);

		term.writeln('Below is a simple emulated backend, try running `help`.');
		const prompt = () => {
			term.write('\r\n$ ');
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
					term.write('\n');
					runCommand(command);
					command = '';
					break;
				case '\u007F': // Backspace (DEL)
					// Do not delete the prompt
					// @ts-ignore
					if (term._core.buffer.x > 2) {
						term.write('\b \b');
						if (command.length > 0) {
							command = command.substr(0, command.length - 1);
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
