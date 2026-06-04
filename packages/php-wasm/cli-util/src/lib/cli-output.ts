interface CLIOutputOptions {
	/** Verbosity level: 'quiet', 'normal', or 'debug' */
	verbosity: string;
	/** Output stream to write to. Defaults to process.stdout */
	writeStream?: NodeJS.WriteStream;
}

export class CLIOutput {
	private verbosity: string;
	protected writeStream: NodeJS.WriteStream;

	constructor(options: CLIOutputOptions) {
		this.verbosity = options.verbosity;
		this.writeStream = options.writeStream || process.stdout;
	}

	get isTTY(): boolean {
		return Boolean(this.writeStream.isTTY);
	}

	get isQuiet(): boolean {
		return this.verbosity === 'quiet';
	}

	/**
	 * ANSI formatting helpers.
	 *
	 * These only apply color codes when outputting to a terminal (TTY).
	 * When piped to files or non-TTY streams, they return plain text to
	 * avoid polluting logs with escape sequences.
	 */
	bold(text: string): string {
		return this.isTTY ? `\x1b[1m${text}\x1b[0m` : text;
	}

	dim(text: string): string {
		return this.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
	}

	italic(text: string): string {
		return this.isTTY ? `\x1b[3m${text}\x1b[0m` : text;
	}

	red(text: string): string {
		return this.isTTY ? `\x1b[31m${text}\x1b[0m` : text;
	}

	green(text: string): string {
		return this.isTTY ? `\x1b[32m${text}\x1b[0m` : text;
	}

	yellow(text: string): string {
		return this.isTTY ? `\x1b[33m${text}\x1b[0m` : text;
	}

	cyan(text: string): string {
		return this.isTTY ? `\x1b[36m${text}\x1b[0m` : text;
	}

	highlight(text: string): string {
		return this.yellow(text);
	}

	print(message: string): void {
		if (this.isQuiet) return;
		this.writeStream.write(`${message}\n`);
	}

	printError(message: string): void {
		this.writeStream.write(`${this.red('Error:')} ${message}\n`);
	}

	printWarning(message: string): void {
		if (this.isQuiet) return;
		this.writeStream.write(`${this.yellow('Warning:')} ${message}\n`);
	}
}
