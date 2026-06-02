import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { CLIOutput } from '../src/cli-output';
import { redactSensitiveText } from '@php-wasm/util';

describe('sensitive CLI output redaction', () => {
	it('redacts credentials and token-like query parameters from displayed text', () => {
		const text = redactSensitiveText(
			'Could not fetch https://user:pass@example.com/blueprint.json?token=secret&keep=1'
		);

		expect(text).toContain('REDACTED');
		expect(text).toContain('keep=1');
		expect(text).not.toContain('user:pass');
		expect(text).not.toContain('token=secret');
	});

	it('redacts the server banner Blueprint URL before resolution runs', () => {
		const { stream, readOutput } = createFakeStream();
		const output = new CLIOutput({
			verbosity: 'normal',
			writeStream: stream,
		});

		output.printConfig({
			phpVersion: '8.3',
			wpVersion: 'latest',
			port: 9400,
			xdebug: false,
			intl: false,
			redis: false,
			memcached: false,
			mounts: [],
			blueprint:
				'https://user:pass@example.com/blueprint.json?access_token=secret&keep=1',
		});

		const text = readOutput();
		expect(text).toContain('Blueprint');
		expect(text).toContain('REDACTED');
		expect(text).toContain('keep=1');
		expect(text).not.toContain('user:pass');
		expect(text).not.toContain('access_token=secret');
	});

	it('redacts custom WordPress ZIP URLs in the server banner', () => {
		const { stream, readOutput } = createFakeStream();
		const output = new CLIOutput({
			verbosity: 'normal',
			writeStream: stream,
		});

		output.printConfig({
			phpVersion: '8.3',
			wpVersion:
				'https://user:pass@example.com/wordpress.zip?token=secret&keep=1',
			port: 9400,
			xdebug: false,
			intl: false,
			redis: false,
			memcached: false,
			mounts: [],
		});

		const text = readOutput();
		expect(text).toContain('WordPress');
		expect(text).toContain('REDACTED');
		expect(text).toContain('keep=1');
		expect(text).not.toContain('user:pass');
		expect(text).not.toContain('token=secret');
	});
});

function createFakeStream() {
	const stream = new PassThrough() as NodeJS.WriteStream & PassThrough;
	stream.isTTY = false;

	let output = '';
	stream.on('data', (chunk) => {
		output += chunk.toString();
	});

	return {
		stream,
		readOutput: () => output,
	};
}
