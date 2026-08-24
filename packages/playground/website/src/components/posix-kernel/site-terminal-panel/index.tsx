import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { PlaygroundClient } from '@wp-playground/client';
import { PaneLoading } from '../../pane-loading';
import css from './style.module.css';

/**
 * Terminal methods the kandelo kernel worker exposes over Comlink (see
 * `packages/playground/remote/src/lib/posix-kernel/playground-worker-
 * endpoint.ts`). They are kernel-mode-only, so they are typed here
 * instead of on `PlaygroundClient` — the Dock only mounts this pane when
 * the `usePosixKernelAvailability` probe confirms the kernel runtime, and
 * the Comlink proxy resolves the methods at call time.
 */
interface TerminalClient {
	startTerminal(
		size: { cols: number; rows: number },
		onOutput: (chunk: Uint8Array) => void,
		onExit: (code: number) => void
	): Promise<number>;
	writeToTerminal(pid: number, data: Uint8Array): Promise<void>;
	resizeTerminal(pid: number, rows: number, cols: number): Promise<void>;
}

/**
 * Placeholder hint rendered in grey next to the shell's first prompt,
 * erased on the first keystroke — the reason it lives here and not as
 * an `echo` in `/etc/bashrc`: bash/readline has no per-keystroke hook,
 * so only the xterm.js layer can make text vanish when typing starts.
 *
 * `SHOW` saves the cursor (DECSC), writes the hint in bright black
 * (SGR 90), and restores the cursor (DECRC) so the caret stays at the
 * prompt and the first typed character lands where the hint began.
 * `ERASE` (ED 0 — erase from the cursor to the end of the screen) then
 * clears the whole hint even when a narrow pane wrapped it onto the
 * next row, which a per-line erase would miss.
 */
const HINT =
	'Welcome to WordPress Playground! Type "playground" for an overview.';
// The leading space keeps the block cursor off the hint's first letter.
const HINT_SHOW = `\x1b7\x1b[90m ${HINT}\x1b[0m\x1b8`;
const HINT_ERASE = '\x1b[0J';

/**
 * Interactive shell into the kandelo kernel that runs this Playground:
 * xterm.js in the pane, `/bin/bash` on a kernel PTY, alongside the live
 * nginx + php-fpm service tree.
 */
export function SiteTerminalPanel({
	playground,
	isVisible,
}: {
	playground: PlaygroundClient | undefined;
	isVisible: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const fitRef = useRef<FitAddon | null>(null);

	// Re-fit when the pane becomes visible again: while hidden the
	// container has zero size, so the ResizeObserver's last measurement
	// is useless and xterm must re-measure.
	useEffect(() => {
		if (isVisible) {
			fitRef.current?.fit();
		}
	}, [isVisible]);

	useEffect(() => {
		const container = containerRef.current;
		if (!playground || !container) {
			return;
		}

		const terminal = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily:
				"'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
			theme: {
				background: '#1e1e1e',
				foreground: '#d4d4d4',
				cursor: '#d4d4d4',
			},
		});
		const fit = new FitAddon();
		terminal.loadAddon(fit);
		terminal.open(container);
		fit.fit();
		fitRef.current = fit;

		const client = playground as unknown as TerminalClient;
		const encoder = new TextEncoder();
		let pid: number | null = null;
		let exited = false;
		let disposed = false;
		// Placeholder lifecycle, reset per shell session: 'pending' until
		// the prompt is on screen and the stream is quiet, 'shown' while
		// the hint is on screen, 'done' once the user typed. The PTY
		// delivers output byte by byte, so the hint is NEVER written
		// straight from the output callback — injecting it between the
		// bytes of an in-flight escape sequence corrupts the sequence and
		// xterm renders the remainder as literal text. Instead every
		// prompt sighting arms a short timer, and the hint is written
		// only once the stream has been idle for a beat (a sequence
		// boundary by construction).
		let hint: 'pending' | 'shown' | 'done' = 'pending';
		let hintTimer: ReturnType<typeof setTimeout> | undefined;
		let promptTail = '';
		let promptDecoder = new TextDecoder();

		const scheduleHint = () => {
			clearTimeout(hintTimer);
			hintTimer = setTimeout(() => {
				if (!disposed && hint === 'pending') {
					terminal.write(HINT_SHOW);
					hint = 'shown';
				}
			}, 50);
		};

		const start = async () => {
			exited = false;
			hint = 'pending';
			promptTail = '';
			promptDecoder = new TextDecoder();
			try {
				pid = await client.startTerminal(
					{ cols: terminal.cols, rows: terminal.rows },
					(chunk) => {
						if (disposed) {
							return;
						}
						// Lift the hint before any new output: after the
						// first prompt, output only arrives from prompt
						// redraws (a pane resize sends SIGWINCH and
						// readline repaints). The redraw ends with the
						// prompt again, so the detection below re-shows
						// the hint after it. Only a keystroke retires it.
						if (hint === 'shown') {
							terminal.write(HINT_ERASE);
							hint = 'pending';
						}
						terminal.write(chunk);
						if (hint === 'pending') {
							// Tail survives chunk boundaries, so a prompt
							// split across chunks is still detected. Strip
							// CSI sequences before matching so trailing
							// control output (e.g. a bracketed-paste
							// enable) cannot hide the PS1 suffix. The tail
							// is long enough that a sequence split across
							// chunks completes before the visible `$ `
							// scrolls out of it.
							promptTail = (
								promptTail +
								promptDecoder.decode(chunk, { stream: true })
							).slice(-64);
							const visibleTail = promptTail.replace(
								// eslint-disable-next-line no-control-regex
								/\x1b\[[^@-~]*[@-~]/g,
								''
							);
							if (visibleTail.endsWith('$ ')) {
								scheduleHint();
							} else {
								clearTimeout(hintTimer);
							}
						}
					},
					(code) => {
						pid = null;
						exited = true;
						if (!disposed) {
							terminal.writeln(
								`\r\n[Shell exited with code ${code} — ` +
									'press Enter to start a new one]'
							);
						}
					}
				);
			} catch (error) {
				exited = true;
				terminal.writeln(
					`\r\n[Failed to start the shell: ${String(error)}]`
				);
			}
		};

		const dataDisposable = terminal.onData((data) => {
			if (exited) {
				if (data.includes('\r')) {
					void start();
				}
				return;
			}
			if (pid === null) {
				return;
			}
			clearTimeout(hintTimer);
			if (hint === 'shown') {
				terminal.write(HINT_ERASE);
			}
			hint = 'done';
			void client.writeToTerminal(pid, encoder.encode(data));
		});
		const resizeDisposable = terminal.onResize(({ cols, rows }) => {
			if (pid === null) {
				return;
			}
			void client.resizeTerminal(pid, rows, cols);
		});
		// Zero-size guard: the observer also fires when the pane is
		// hidden (display: none), and fitting against a 0x0 container
		// would collapse the PTY to 1 column.
		const resizeObserver = new ResizeObserver(() => {
			if (container.offsetWidth > 0 && container.offsetHeight > 0) {
				fit.fit();
			}
		});
		resizeObserver.observe(container);

		void start();

		return () => {
			disposed = true;
			clearTimeout(hintTimer);
			fitRef.current = null;
			dataDisposable.dispose();
			resizeDisposable.dispose();
			resizeObserver.disconnect();
			terminal.dispose();
		};
	}, [playground]);

	if (!playground) {
		return <PaneLoading message="The Playground is still loading…" />;
	}
	return <div className={css.terminal} ref={containerRef} />;
}
