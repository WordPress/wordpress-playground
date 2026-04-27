/**
 * Manages formatted terminal output for the WordPress Playground CLI.
 *
 * Extends the base CLIOutput from @php-wasm/cli-util with
 * Playground-specific output: config summary, progress indicators,
 * and server-ready messages.
 *
 * Progress updates rewrite the same line in TTY mode to create smooth
 * animations. When output is piped or redirected, progress is suppressed
 * to avoid cluttering logs with intermediate states.
 */

import { CLIOutput as BaseCLIOutput } from '@php-wasm/cli-util';
import { shouldRenderProgress } from './utils/progress';
import type { Mount } from '@php-wasm/cli-util';

/**
 * Configuration details displayed at CLI startup.
 */
export interface ConfigSummary {
	phpVersion: string;
	wpVersion: string;
	port: number;
	xdebug: boolean;
	intl: boolean;
	redis: boolean;
	memcached: boolean;
	/** All mounts (both manual and auto-detected). Auto-mounts have autoMounted: true */
	mounts: Mount[];
	blueprint?: string;
}

export class CLIOutput extends BaseCLIOutput {
	private lastProgressLine = '';
	private progressActive = false;

	/**
	 * Determines if progress updates should be rendered.
	 *
	 * Returns false when output is piped, redirected, or in CI environments.
	 * This prevents progress spam in logs - users only see the final outcome.
	 */
	get shouldRender(): boolean {
		return shouldRenderProgress(this.writeStream);
	}

	printBanner(): void {
		if (this.isQuiet) return;

		const banner = this.bold('WordPress Playground CLI');
		this.writeStream.write(`\n${banner}\n\n`);
	}

	/**
	 * Prints the configuration summary before starting the server.
	 *
	 * Displays PHP/WordPress versions, enabled extensions, all mounts
	 * (with auto-mounts labeled), and any loaded blueprint. This gives
	 * users a clear view of what's configured before the server boots.
	 */
	printConfig(config: ConfigSummary): void {
		if (this.isQuiet) return;

		const lines: string[] = [];

		// PHP and WordPress versions
		lines.push(
			`${this.dim('PHP')} ${this.cyan(config.phpVersion)}  ${this.dim('WordPress')} ${this.cyan(config.wpVersion)}`
		);

		// Extensions
		const extensions: string[] = [];
		if (config.intl) extensions.push('intl');
		if (config.redis) extensions.push('redis');
		if (config.memcached) extensions.push('memcached');
		if (config.xdebug) extensions.push(this.yellow('xdebug'));
		if (extensions.length > 0) {
			lines.push(`${this.dim('Extensions')} ${extensions.join(', ')}`);
		}

		// Display all mounts
		if (config.mounts.length > 0) {
			for (const mount of config.mounts) {
				const autoMountLabel = mount.autoMounted
					? ` ${this.dim('(auto-mount)')}`
					: '';
				lines.push(
					`${this.dim('Mount')} ${mount.hostPath} ${this.dim('→')} ${mount.vfsPath}${autoMountLabel}`
				);
			}
		}

		// Blueprint if specified
		if (config.blueprint) {
			lines.push(`${this.dim('Blueprint')} ${config.blueprint}`);
		}

		this.writeStream.write(lines.join('\n') + '\n\n');
	}

	/**
	 * Starts a progress indicator that updates in-place.
	 *
	 * Subsequent updateProgress() calls rewrite the same line in TTY mode.
	 * When output is piped or redirected, progress is completely skipped.
	 */
	startProgress(message: string): void {
		if (this.isQuiet) return;
		if (!this.shouldRender) return;

		this.progressActive = true;
		this.updateProgress(message);
	}

	/**
	 * Updates the current progress message and optional percentage.
	 *
	 * Rewrites the current line using ANSI cursor control in TTY mode.
	 * Identical messages are skipped to prevent flickering. When piped,
	 * this method does nothing (early return via shouldRender check).
	 */
	updateProgress(message: string, percent?: number): void {
		if (this.isQuiet) return;
		if (!this.shouldRender) return;
		if (!this.progressActive) {
			this.progressActive = true;
		}

		let fullMessage = `${message}`;
		if (percent !== undefined) {
			fullMessage = `${message} ${this.dim(`${percent}%`)}`;
		}

		// Skip identical messages to prevent flickering
		if (fullMessage === this.lastProgressLine) {
			return;
		}
		this.lastProgressLine = fullMessage;

		if (this.isTTY) {
			// Rewrite the current line
			this.writeStream.cursorTo(0);
			this.writeStream.write(fullMessage);
			this.writeStream.clearLine(1);
		} else {
			// Fallback: print on new line if somehow rendered in non-TTY
			this.writeStream.write(`${fullMessage}\n`);
		}
	}

	/**
	 * Completes the progress indicator and moves to a new line.
	 *
	 * Optionally displays a final message before finishing. In TTY mode,
	 * this ensures the cursor moves to the next line after the progress.
	 */
	finishProgress(finalMessage?: string): void {
		if (this.isQuiet) return;
		if (!this.shouldRender) return;

		if (finalMessage) {
			if (this.isTTY) {
				this.writeStream.cursorTo(0);
				this.writeStream.write(`${finalMessage}`);
				this.writeStream.clearLine(1);
			} else {
				this.writeStream.write(`${finalMessage}\n`);
			}
		}

		if (this.isTTY) {
			this.writeStream.write('\n');
		}

		this.progressActive = false;
		this.lastProgressLine = '';
	}

	/**
	 * Prints a status message, interrupting any active progress.
	 *
	 * Unlike progress updates, status messages are always printed on their
	 * own line. Any active progress indicator is cleared before the message.
	 */
	printStatus(message: string): void {
		if (this.isQuiet) return;

		// Clear any active progress line before printing status
		if (this.progressActive && this.isTTY) {
			this.writeStream.cursorTo(0);
			this.writeStream.clearLine(0);
		}

		this.writeStream.write(`${message}\n`);
		this.progressActive = false;
		this.lastProgressLine = '';
	}

	/**
	 * Prints an error message.
	 *
	 * Errors are always shown, even in quiet mode, and interrupt any
	 * active progress display to ensure visibility.
	 */
	override printError(message: string): void {
		// Clear any active progress first
		if (this.progressActive && this.isTTY) {
			this.writeStream.cursorTo(0);
			this.writeStream.clearLine(0);
			this.progressActive = false;
		}

		this.writeStream.write(`${this.red('Error:')} ${message}\n`);
	}

	/**
	 * Prints the final "server ready" message with the URL.
	 *
	 * Note: The exact wording "WordPress is running on" is checked by
	 * CI tests, so changes to this string will break test assertions.
	 */
	printReady(url: string, workerCount: number): void {
		if (this.isQuiet) return;

		const workerLabel = workerCount === 1 ? 'worker' : 'workers';
		this.writeStream.write(
			`\n${this.green('Ready!')} WordPress is running on ${this.bold(url)} ${this.dim(`(${workerCount} ${workerLabel})`)}\n\n`
		);
	}

	/**
	 * Prints the phpMyAdmin URL when the --phpmyadmin flag is enabled.
	 */
	printPhpMyAdminUrl(url: string): void {
		if (this.isQuiet) return;

		this.writeStream.write(
			`${this.cyan('phpMyAdmin')} available at ${this.bold(url)}\n\n`
		);
	}
}
