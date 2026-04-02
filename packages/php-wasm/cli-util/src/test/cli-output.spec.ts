import { CLIOutput } from '../lib/cli-output';
import { PassThrough } from 'stream';

/**
 * Creates a fake WriteStream backed by a PassThrough stream.
 * Collects all written data into a string for assertions.
 */
function createFakeStream(options: { isTTY: boolean }): {
	stream: NodeJS.WriteStream;
	output: () => string;
} {
	const passThrough = new PassThrough();
	let data = '';
	passThrough.on('data', (chunk) => {
		data += chunk.toString();
	});

	const stream = passThrough as unknown as NodeJS.WriteStream;
	stream.isTTY = options.isTTY;

	return { stream, output: () => data };
}

describe('CLIOutput', () => {
	describe('formatting in TTY mode', () => {
		it('should apply ANSI bold codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.bold('test')).toBe('\x1b[1mtest\x1b[0m');
		});

		it('should apply ANSI dim codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.dim('test')).toBe('\x1b[2mtest\x1b[0m');
		});

		it('should apply ANSI italic codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.italic('test')).toBe('\x1b[3mtest\x1b[0m');
		});

		it('should apply ANSI red codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.red('test')).toBe('\x1b[31mtest\x1b[0m');
		});

		it('should apply ANSI green codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.green('test')).toBe('\x1b[32mtest\x1b[0m');
		});

		it('should apply ANSI yellow codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.yellow('test')).toBe('\x1b[33mtest\x1b[0m');
		});

		it('should apply ANSI cyan codes', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.cyan('test')).toBe('\x1b[36mtest\x1b[0m');
		});

		it('should map highlight to yellow', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.highlight('test')).toBe(output.yellow('test'));
		});
	});

	describe('formatting in non-TTY mode', () => {
		it('should return plain text for all formatters', () => {
			const { stream } = createFakeStream({ isTTY: false });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.bold('test')).toBe('test');
			expect(output.dim('test')).toBe('test');
			expect(output.italic('test')).toBe('test');
			expect(output.red('test')).toBe('test');
			expect(output.green('test')).toBe('test');
			expect(output.yellow('test')).toBe('test');
			expect(output.cyan('test')).toBe('test');
			expect(output.highlight('test')).toBe('test');
		});
	});

	describe('print', () => {
		it('should write message with newline', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			cliOutput.print('hello');
			expect(getOutput()).toBe('hello\n');
		});

		it('should suppress output in quiet mode', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'quiet',
				writeStream: stream,
			});

			cliOutput.print('hello');
			expect(getOutput()).toBe('');
		});
	});

	describe('printError', () => {
		it('should prefix with Error:', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			cliOutput.printError('something broke');
			expect(getOutput()).toBe('Error: something broke\n');
		});

		it('should print even in quiet mode', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'quiet',
				writeStream: stream,
			});

			cliOutput.printError('something broke');
			expect(getOutput()).toBe('Error: something broke\n');
		});
	});

	describe('printWarning', () => {
		it('should prefix with Warning:', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			cliOutput.printWarning('watch out');
			expect(getOutput()).toBe('Warning: watch out\n');
		});

		it('should suppress in quiet mode', () => {
			const { stream, output: getOutput } = createFakeStream({
				isTTY: false,
			});
			const cliOutput = new CLIOutput({
				verbosity: 'quiet',
				writeStream: stream,
			});

			cliOutput.printWarning('watch out');
			expect(getOutput()).toBe('');
		});
	});

	describe('isTTY', () => {
		it('should return true for TTY streams', () => {
			const { stream } = createFakeStream({ isTTY: true });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.isTTY).toBe(true);
		});

		it('should return false for non-TTY streams', () => {
			const { stream } = createFakeStream({ isTTY: false });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.isTTY).toBe(false);
		});
	});

	describe('isQuiet', () => {
		it('should return true when verbosity is quiet', () => {
			const { stream } = createFakeStream({ isTTY: false });
			const output = new CLIOutput({
				verbosity: 'quiet',
				writeStream: stream,
			});

			expect(output.isQuiet).toBe(true);
		});

		it('should return false when verbosity is normal', () => {
			const { stream } = createFakeStream({ isTTY: false });
			const output = new CLIOutput({
				verbosity: 'normal',
				writeStream: stream,
			});

			expect(output.isQuiet).toBe(false);
		});
	});
});
