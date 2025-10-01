import { useEffect, useRef, useState } from 'react';
import {
	basename,
	joinPaths,
	normalizePath,
	splitShellCommand,
} from '@php-wasm/util';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import styles from './Terminal.module.css';
import 'xterm/css/xterm.css';
import type { StreamedPHPResponse } from '@php-wasm/universal';
import type { PlaygroundClient } from '@wp-playground/client';
import { DEFAULT_WORKSPACE_DIR } from '../../constants';
import TerminalPlaceholder from './TerminalPlaceholder';

const PROGRESS_BAR_WIDTH = 28;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];

interface DownloadProgress {
	label: string;
	totalBytes: number;
	receivedBytes: number;
	spinnerIndex: number;
	lastRenderedLength: number;
}

const formatBytes = (bytes: number) => {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const units = ['KB', 'MB', 'GB'];
	let size = bytes / 1024;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const drawProgress = (term: XTerm, progress: DownloadProgress) => {
	let line: string;
	if (progress.totalBytes > 0) {
		const percent = Math.min(
			100,
			Math.round((progress.receivedBytes / progress.totalBytes) * 100)
		);
		const filled = Math.round((PROGRESS_BAR_WIDTH * percent) / 100);
		const bar = '#'.repeat(filled).padEnd(PROGRESS_BAR_WIDTH, ' ');
		line = `${progress.label}: [${bar}] ${percent
			.toString()
			.padStart(3, ' ')}%`;
	} else {
		const spinner =
			SPINNER_FRAMES[progress.spinnerIndex % SPINNER_FRAMES.length];
		line = `${progress.label}: ${spinner} ${formatBytes(
			progress.receivedBytes
		)}`;
	}
	const padLength = Math.max(line.length, progress.lastRenderedLength);
	term.write(`\r${line.padEnd(padLength, ' ')}`);
	progress.lastRenderedLength = padLength;
};

interface TerminalWrapperProps {
	playgroundClient?: PlaygroundClient;
	isCollapsed: boolean;
	resizeToken?: number;
}
export const TerminalWrapper = ({
	playgroundClient,
	isCollapsed,
	resizeToken = 0,
}: TerminalWrapperProps) => {
	const [cwd, setCwd] = useState<string | null>(null);

	useEffect(() => {
		if (playgroundClient) {
			playgroundClient
				.isReady()
				.then(() => playgroundClient.cwd())
				.then((cwd) => {
					setCwd(cwd);
				});
		}
	}, [playgroundClient]);

	if (!playgroundClient || cwd === null) {
		return <TerminalPlaceholder />;
	}

	return (
		<TerminalComponent
			playgroundClient={playgroundClient!}
			isCollapsed={isCollapsed}
			resizeToken={resizeToken}
		/>
	);
};

interface TerminalComponentProps extends TerminalWrapperProps {
	playgroundClient: PlaygroundClient;
}
export const TerminalComponent = ({
	playgroundClient,
	isCollapsed,
	resizeToken = 0,
}: TerminalComponentProps) => {
	const terminalContainerRef = useRef<HTMLDivElement | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const progressRef = useRef<DownloadProgress | null>(null);
	const clientRef = useRef<PlaygroundClient | null>(null);

	const cwdRef = useRef<string>(DEFAULT_WORKSPACE_DIR);

	useEffect(() => {
		clientRef.current = playgroundClient;
		if (clientRef.current) {
			clientRef.current
				.isReady()
				.then(() => clientRef.current!.cwd())
				.then((cwd) => {
					cwdRef.current = cwd;
				});
		}
	}, [playgroundClient]);

	useEffect(() => {
		const container = terminalContainerRef.current;
		if (!container) {
			return;
		}

		const term = new XTerm({
			convertEol: true,
			fontSize: 14,
			theme: {
				background: '#111111',
				foreground: '#f1f5f9',
			},
			cursorBlink: true,
		});
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(container);
		fitAddonRef.current = fitAddon;
		requestAnimationFrame(() => {
			try {
				fitAddon.fit();
			} catch {
				/* ignore errors */
			}
		});

		const viewport = container.querySelector(
			'.xterm-viewport'
		) as HTMLElement | null;
		let shouldStickToBottom = true;
		const updateStickiness = () => {
			if (!viewport) {
				return;
			}
			const { scrollTop, clientHeight, scrollHeight } = viewport;
			shouldStickToBottom =
				scrollHeight - (scrollTop + clientHeight) <= 4;
		};
		viewport?.addEventListener('scroll', updateStickiness);

		const autoScroll = () => {
			if (!shouldStickToBottom) {
				return;
			}
			requestAnimationFrame(() => {
				try {
					term.scrollToBottom();
				} catch {
					/* ignore errors */
				}
			});
		};

		const promptPrefix = () => {
			const dirName = basename(cwdRef.current) || '/';
			return `(${dirName}) $ `;
		};
		const resolvePath = (target: string) => {
			if (!target || target === '~') {
				return cwdRef.current;
			}
			if (target.startsWith('~/')) {
				target = joinPaths(cwdRef.current, target.slice(2));
			}
			const rawPath = target.startsWith('/')
				? target
				: joinPaths(cwdRef.current, target);
			return normalizePath(rawPath || '/');
		};

		const startDownloadProgress = (label: string, totalBytes: number) => {
			progressRef.current = {
				label,
				totalBytes,
				receivedBytes: 0,
				spinnerIndex: 0,
				lastRenderedLength: 0,
			};
			term.writeln('');
			drawProgress(term, progressRef.current);
			autoScroll();
		};

		const updateDownloadProgress = (
			receivedBytes: number,
			totalBytes: number
		) => {
			if (!progressRef.current) {
				return;
			}
			progressRef.current.receivedBytes = receivedBytes;
			if (totalBytes) {
				progressRef.current.totalBytes = totalBytes;
			}
			progressRef.current.spinnerIndex += 1;
			drawProgress(term, progressRef.current);
		};

		const finishDownloadProgress = (message: string) => {
			if (!progressRef.current) {
				return;
			}
			if (progressRef.current.totalBytes) {
				progressRef.current.receivedBytes =
					progressRef.current.totalBytes;
				drawProgress(term, progressRef.current);
			}
			term.writeln('');
			term.writeln(`${progressRef.current.label}: ${message}`);
			progressRef.current = null;
			autoScroll();
		};

		const failDownloadProgress = (message: string) => {
			if (!progressRef.current) {
				term.writeln(message);
				autoScroll();
				return;
			}
			const failureLine = `${progressRef.current.label}: failed`;
			const pad = Math.max(
				failureLine.length,
				progressRef.current.lastRenderedLength
			);
			term.write(`\r${failureLine.padEnd(pad, ' ')}`);
			term.writeln('');
			term.writeln(message);
			progressRef.current = null;
			autoScroll();
		};

		const prompt = (newLine = true) => {
			term.write(newLine ? `\r\n${promptPrefix()}` : promptPrefix());
			autoScroll();
		};

		const refreshInputLine = (currentLine: string) => {
			term.write(`\r\x1b[2K${promptPrefix()}${currentLine}`);
			autoScroll();
		};

		const writeStdout = (text: string) => {
			if (!text) {
				return;
			}
			term.write(text.replace(/\r?\n/g, '\r\n'));
			autoScroll();
		};

		const writeStderr = (text: string) => {
			if (!text) {
				return;
			}
			term.write(`\u001b[31m${text.replace(/\r?\n/g, '\r\n')}\u001b[0m`);
			autoScroll();
		};

		term.writeln(
			'WordPress Playground CLI ready. Type `help` to see available commands.'
		);
		autoScroll();
		prompt(false);

		const downloadWithProgress = async (url: string, label: string) => {
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(
						`Failed to download ${label.toLowerCase()}.`
					);
				}
				const totalHeader = response.headers.get('content-length');
				const totalBytes = totalHeader ? Number(totalHeader) : 0;
				startDownloadProgress(label, totalBytes);

				if (!response.body || !response.body.getReader) {
					const buffer = await response.arrayBuffer();
					finishDownloadProgress('complete');
					return new Uint8Array(buffer);
				}

				const reader = response.body.getReader();
				const chunks: Uint8Array[] = [];
				let received = 0;
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						break;
					}
					if (value) {
						chunks.push(value);
						received += value.byteLength;
						updateDownloadProgress(received, totalBytes);
					}
				}

				const bytes = new Uint8Array(received);
				let offset = 0;
				for (const chunk of chunks) {
					bytes.set(chunk, offset);
					offset += chunk.byteLength;
				}
				finishDownloadProgress('complete');
				return bytes;
			} catch (error: any) {
				failDownloadProgress(error?.message || String(error));
				throw error;
			}
		};

		const ensureBootReady = async () => {
			if (!clientRef.current) {
				throw new Error('Playground client is not ready yet.');
			}
			await clientRef.current.isReady();
			return clientRef.current;
		};

		const ensureWpCliBinary = async () => {
			const client = await ensureBootReady();
			const path = '/tmp/wp-cli.phar';
			if (await client.fileExists(path)) {
				return;
			}
			term.writeln('\r\nPreparing WP-CLI...');
			autoScroll();
			const binary = await downloadWithProgress(
				'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
				'WP-CLI download'
			);
			await client.writeFile(path, binary);
		};

		const ensureComposerBinary = async () => {
			const client = await ensureBootReady();
			const path = '/tmp/composer.phar';
			if (await client.fileExists(path)) {
				return;
			}
			term.writeln('\r\nPreparing Composer...');
			autoScroll();
			const binary = await downloadWithProgress(
				'https://wordpress-playground-cors-proxy.net/?https://getcomposer.org/download/2.8.12/composer.phar',
				'Composer download'
			);
			await client.writeFile(`${path}`, binary);
			await client.writeFile(
				`/internal/shared/preload/grapheme_polyfill.php`,
				`<?php
// Composer assumes the grapheme_strlen function is available
// and will crash if it's not. Symfony Polyfills somehow do
// not kick in in this case.
if(!function_exists('grapheme_strlen')) {
	function grapheme_strlen($string) {
		return strlen($string);
	}
}
if(!function_exists('grapheme_substr')) {
	function grapheme_substr($string, $start, $length) {
		return substr($string, $start, $length);
	}
}
`
			);
		};

		const runCli = async (
			argv: string[],
			options: { env?: Record<string, string> } = {}
		) => {
			const client = await ensureBootReady();
			const response = (await client.cli(
				argv,
				options
			)) as StreamedPHPResponse & {
				terminate?: () => Promise<void> | void;
			};
			const stdoutReader = response.stdout.getReader();
			const stderrReader = response.stderr.getReader();
			const stdoutDecoder = new TextDecoder();
			const stderrDecoder = new TextDecoder();
			const terminateResponse =
				typeof response.terminate === 'function'
					? async () => {
							try {
								await response.terminate!();
							} catch {
								/* ignore errors */
							}
					  }
					: null;
			let aborted = false;
			const activeProcess = {
				async terminate() {
					if (aborted) {
						return;
					}
					aborted = true;
					try {
						await stdoutReader.cancel();
					} catch {
						/* ignore errors */
					}
					try {
						await stderrReader.cancel();
					} catch {
						/* ignore errors */
					}
					if (terminateResponse) {
						await terminateResponse();
					}
				},
			};
			currentProcess = activeProcess;

			const streamStdout = (async () => {
				try {
					while (!aborted) {
						const { value, done } = await stdoutReader.read();
						if (done) {
							break;
						}
						if (value) {
							const text = stdoutDecoder.decode(value, {
								stream: true,
							});
							writeStdout(text);
						}
					}
					const flush = stdoutDecoder.decode();
					writeStdout(flush);
				} catch (error) {
					if (!aborted) {
						throw error;
					}
				}
			})();

			const streamStderr = (async () => {
				try {
					while (!aborted) {
						const { value, done } = await stderrReader.read();
						if (done) {
							break;
						}
						if (value) {
							const text = stderrDecoder.decode(value, {
								stream: true,
							});
							writeStderr(text);
						}
					}
					const flush = stderrDecoder.decode();
					writeStderr(flush);
				} catch (error) {
					if (!aborted) {
						throw error;
					}
				}
			})();

			const exitCodePromise = response.exitCode.catch((error: any) => {
				if (!aborted) {
					throw error;
				}
				return 130;
			});

			const [, , exitCode] = await Promise.all([
				streamStdout.catch(() => {}),
				streamStderr.catch(() => {}),
				exitCodePromise,
			]);

			prompt();

			return { exitCode, aborted };
		};

		const commandHistory: string[] = [];
		let historyIndex = -1;
		let currentLine = '';
		let isRunningCommand = false;
		let currentProcess: { terminate: () => Promise<void> } | null = null;
		let lastInputChar = '';

		const runTerminalCommand = async (rawInput: string) => {
			const trimmed = rawInput.trim();
			if (!trimmed) {
				isRunningCommand = false;
				prompt();
				return;
			}
			const parts = splitShellCommand(trimmed);
			if (!parts.length) {
				isRunningCommand = false;
				prompt();
				return;
			}

			const [command, ...args] = parts;
			let commandPrompted = false;
			try {
				if (command === 'help') {
					term.writeln(
						'\r\nAvailable commands:\r\n  help        Show this message\r\n  php <...>  Run PHP CLI arguments\r\n  wp <...>   Run WP-CLI (auto-downloads if needed)\r\n  composer <...>  Run Composer (auto-downloads if needed)\r\n  cd <path>  Change directory (only affects prompt)'
					);
					autoScroll();
					prompt();
					commandPrompted = true;
				} else if (command === 'cd') {
					const target = args[0] ?? '';
					const client = await ensureBootReady();
					const resolvedPath = resolvePath(target);
					let isDirectory = false;
					try {
						isDirectory = await client.isDir(resolvedPath);
					} catch {
						isDirectory = false;
					}
					if (!isDirectory) {
						const message = target || resolvedPath;
						term.writeln(
							`\r\ncd: no such file or directory: ${message}`
						);
						autoScroll();
						return;
					}
					await client.chdir(resolvedPath);
					cwdRef.current = resolvedPath;
					prompt();
					commandPrompted = true;
				} else if (command === 'wp') {
					await ensureWpCliBinary();
					const result = await runCli([
						'php',
						'/tmp/wp-cli.phar',
						'--path=/wordpress',
						...args,
					]);
					if (!result.aborted && result.exitCode !== 0) {
						term.writeln(
							`\r\nProcess exited with code ${result.exitCode}`
						);
						autoScroll();
					}
					commandPrompted = true;
				} else if (command === 'composer') {
					await ensureComposerBinary();
					const result = await runCli([
						'php',
						'/tmp/composer.phar',
						...args,
					]);
					if (!result.aborted && result.exitCode !== 0) {
						term.writeln(
							`\r\nProcess exited with code ${result.exitCode}`
						);
						autoScroll();
					}
					commandPrompted = true;
				} else if (command === 'php') {
					if (!args.length) {
						term.writeln('\r\nUsage: php <arguments>');
						autoScroll();
						prompt();
						commandPrompted = true;
					} else {
						const result = await runCli(['php', ...args]);
						if (!result.aborted && result.exitCode !== 0) {
							term.writeln(
								`\r\nProcess exited with code ${result.exitCode}`
							);
							autoScroll();
						}
						commandPrompted = true;
					}
				} else {
					const result = await runCli([command, ...args]);
					if (!result.aborted && result.exitCode !== 0) {
						term.writeln(
							`\r\nProcess exited with code ${result.exitCode}`
						);
						autoScroll();
					}
					// term.writeln(`\r\n${command}: command not found`);
					commandPrompted = true;
				}
			} catch (error: any) {
				const message = error?.message || String(error);
				term.writeln(`\r\nError: ${message}`);
				autoScroll();
			} finally {
				isRunningCommand = false;
				if (!currentProcess && !commandPrompted) {
					prompt();
				}
			}
		};

		const abortActiveProcess = async () => {
			if (!currentProcess) {
				isRunningCommand = false;
				prompt();
				return;
			}
			try {
				await currentProcess.terminate();
			} finally {
				currentProcess = null;
				isRunningCommand = false;
			}
		};

		term.onData((chunk) => {
			for (const char of chunk) {
				if (char === '\u0003') {
					term.write('^C');
					autoScroll();
					currentLine = '';
					void abortActiveProcess();
					lastInputChar = char;
					continue;
				}
				if (isRunningCommand) {
					lastInputChar = char;
					continue;
				}
				switch (char) {
					case '\r':
					case '\n': {
						if (char === '\n' && lastInputChar === '\r') {
							break;
						}
						term.write('\r\n');
						autoScroll();
						const submitted = currentLine;
						if (submitted.trim()) {
							commandHistory.unshift(submitted);
						}
						historyIndex = -1;
						currentLine = '';
						isRunningCommand = true;
						void runTerminalCommand(submitted);
						break;
					}
					case '\u007f': {
						if (currentLine.length > 0) {
							currentLine = currentLine.slice(0, -1);
							term.write('\b \b');
						}
						break;
					}
					default: {
						if (char === '\n') {
							break;
						}
						if (char >= ' ' || char >= '\u00a0') {
							currentLine += char;
							term.write(char);
						}
						break;
					}
				}
				lastInputChar = char;
			}
		});

		term.attachCustomKeyEventHandler((event) => {
			if (event.type !== 'keydown') {
				return true;
			}
			if (event.metaKey || event.ctrlKey) {
				return true;
			}
			if (event.code === 'ArrowUp') {
				event.preventDefault();
				if (!commandHistory.length) {
					return false;
				}
				const nextIndex = historyIndex + 1;
				if (nextIndex < commandHistory.length) {
					historyIndex = nextIndex;
					currentLine = commandHistory[historyIndex];
					refreshInputLine(currentLine);
				}
				return false;
			}
			if (event.code === 'ArrowDown') {
				event.preventDefault();
				if (historyIndex > 0) {
					historyIndex -= 1;
					currentLine = commandHistory[historyIndex];
				} else {
					historyIndex = -1;
					currentLine = '';
				}
				refreshInputLine(currentLine);
				return false;
			}
			return true;
		});

		return () => {
			viewport?.removeEventListener('scroll', updateStickiness);
			term.dispose();
			fitAddonRef.current = null;
			progressRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (isCollapsed) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			try {
				fitAddonRef.current?.fit();
			} catch {
				/* ignore errors */
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [isCollapsed, resizeToken]);

	useEffect(() => {
		const handleResize = () => {
			if (!isCollapsed) {
				try {
					fitAddonRef.current?.fit();
				} catch {
					/* ignore errors */
				}
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isCollapsed]);

	useEffect(() => {
		const container = terminalContainerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => {
			if (isCollapsed) {
				return;
			}
			try {
				fitAddonRef.current?.fit();
			} catch {
				/* ignore errors */
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [isCollapsed]);

	return (
		<div
			ref={terminalContainerRef}
			id="terminal"
			className={styles.terminal}
			aria-live="polite"
		/>
	);
};
