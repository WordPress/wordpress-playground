import {
	PHP,
	proxyFileSystem,
	SupportedPHPVersions,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const phpVersionsToTest =
	'PHP' in process.env
		? [process.env['PHP']! as SupportedPHPVersion]
		: SupportedPHPVersions;

describe.each(phpVersionsToTest)('PHP %s: PROXYFS paths', (phpVersion) => {
	let primary: PHP;
	let replica: PHP;

	beforeEach(async () => {
		primary = new PHP(await loadNodeRuntime(phpVersion));
		replica = new PHP(await loadNodeRuntime(phpVersion));
		await proxyFileSystem(primary, replica, ['/tmp']);
	});

	afterEach(() => {
		replica.exit();
		primary.exit();
	});

	it('recreates a file deleted by the primary after a proxied read', () => {
		primary.writeFile('/tmp/stage.txt', 'old');
		expect(replica.readFileAsText('/tmp/stage.txt')).toBe('old');

		primary.unlink('/tmp/stage.txt');
		replica.writeFile('/tmp/stage.txt', 'new');

		expect(primary.readFileAsText('/tmp/stage.txt')).toBe('new');
	});

	it('exclusively creates a file deleted by the primary', async () => {
		primary.writeFile('/tmp/stage.txt', 'old');
		expect(replica.readFileAsText('/tmp/stage.txt')).toBe('old');
		primary.unlink('/tmp/stage.txt');

		const result = await replica.run({
			code: `<?php
				$file = fopen('/tmp/stage.txt', 'x');
				fwrite($file, 'new');
				fclose($file);
			`,
		});

		expect(result.errors).toBe('');
		expect(primary.readFileAsText('/tmp/stage.txt')).toBe('new');
	});

	it('recreates a directory deleted by the primary', () => {
		primary.mkdir('/tmp/stage');
		expect(replica.isDir('/tmp/stage')).toBe(true);

		primary.rmdir('/tmp/stage');
		replica.mkdir('/tmp/stage');
		replica.writeFile('/tmp/stage/file.txt', 'new');

		expect(primary.readFileAsText('/tmp/stage/file.txt')).toBe('new');
	});

	it('recreates the old path after the primary renames a file', () => {
		primary.writeFile('/tmp/source.txt', 'original');
		expect(replica.readFileAsText('/tmp/source.txt')).toBe('original');

		primary.mv('/tmp/source.txt', '/tmp/destination.txt');
		replica.writeFile('/tmp/source.txt', 'replacement');

		expect(primary.readFileAsText('/tmp/source.txt')).toBe('replacement');
		expect(replica.readFileAsText('/tmp/destination.txt')).toBe('original');
	});

	it('sees a directory that replaced a previously read file', () => {
		primary.writeFile('/tmp/stage', 'old');
		expect(replica.readFileAsText('/tmp/stage')).toBe('old');

		primary.unlink('/tmp/stage');
		primary.mkdir('/tmp/stage');
		replica.writeFile('/tmp/stage/file.txt', 'new');

		expect(primary.readFileAsText('/tmp/stage/file.txt')).toBe('new');
	});

	it('sees a file that replaced a previously checked directory', () => {
		primary.mkdir('/tmp/stage');
		expect(replica.isDir('/tmp/stage')).toBe(true);

		primary.rmdir('/tmp/stage');
		primary.writeFile('/tmp/stage', 'new');

		expect(replica.readFileAsText('/tmp/stage')).toBe('new');
	});

	it('recreates a renamed file deleted by the primary', () => {
		replica.writeFile('/tmp/source.txt', 'old');
		replica.mv('/tmp/source.txt', '/tmp/destination.txt');

		primary.unlink('/tmp/destination.txt');
		replica.writeFile('/tmp/destination.txt', 'new');

		expect(primary.readFileAsText('/tmp/destination.txt')).toBe('new');
	});

	it('recreates a file deleted by another replica', async () => {
		using otherReplica = new PHP(await loadNodeRuntime(phpVersion));
		await proxyFileSystem(primary, otherReplica, ['/tmp']);
		primary.writeFile('/tmp/stage.txt', 'old');
		expect(replica.readFileAsText('/tmp/stage.txt')).toBe('old');

		otherReplica.unlink('/tmp/stage.txt');
		replica.writeFile('/tmp/stage.txt', 'new');

		expect(otherReplica.readFileAsText('/tmp/stage.txt')).toBe('new');
		expect(primary.readFileAsText('/tmp/stage.txt')).toBe('new');
	});

	it('keeps nested mounts attached to proxied directories', async () => {
		using nestedSource = new PHP(await loadNodeRuntime(phpVersion));
		await proxyFileSystem(nestedSource, replica, ['/tmp/parent/nested']);
		nestedSource.writeFile('/tmp/parent/nested/file.txt', 'nested');

		expect(replica.readFileAsText('/tmp/parent/nested/file.txt')).toBe(
			'nested'
		);
		primary.chmod('/tmp/parent', 0o700);
		replica.writeFile('/tmp/parent/nested/file.txt', 'updated');

		expect(nestedSource.readFileAsText('/tmp/parent/nested/file.txt')).toBe(
			'updated'
		);
		expect(primary.fileExists('/tmp/parent/nested/file.txt')).toBe(false);
	});
});
