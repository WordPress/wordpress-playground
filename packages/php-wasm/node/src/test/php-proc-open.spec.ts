import { spawn } from 'child_process';
import {
	SupportedPHPVersions,
	setPhpIniEntries,
	PHP,
	type SpawnHandler,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

describe.each(phpVersions)('PHP %s – proc_open', (phpVersion) => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(phpVersion as any));
		await setPhpIniEntries(php, { allow_url_fopen: 1 });
	});

	afterEach(() => {
		php.exit();
	});

	it('proc_open works with native spawn handler', async () => {
		await php.setSpawnHandler(spawn as unknown as SpawnHandler);

		const result = await php.run({
			code: `<?php
				$desc = [
					0 => ['pipe', 'r'],
					1 => ['pipe', 'w'],
					2 => ['pipe', 'w'],
				];
				$proc = proc_open('/bin/echo hello_from_proc_open', $desc, $pipes);
				if (is_resource($proc)) {
					$stdout = stream_get_contents($pipes[1]);
					fclose($pipes[0]);
					fclose($pipes[1]);
					fclose($pipes[2]);
					$code = proc_close($proc);
					echo trim($stdout);
				} else {
					echo 'PROC_OPEN_FAILED';
				}
			`,
		});

		expect(result.text).toBe('hello_from_proc_open');
	});

	it('shell_exec works with native spawn handler', async () => {
		await php.setSpawnHandler(spawn as unknown as SpawnHandler);

		const result = await php.run({
			code: `<?php
				$out = shell_exec('/bin/echo hello_from_shell_exec');
				echo trim($out ?? 'NULL');
			`,
		});

		expect(result.text).toBe('hello_from_shell_exec');
	});

	it('proc_open throws without spawn handler', async () => {
		const result = await php.run({
			code: `<?php
				$desc = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
				$proc = @proc_open('echo test', $desc, $pipes);
				echo is_resource($proc) ? 'OPENED' : 'FAILED';
			`,
		});

		// Without a spawn handler, proc_open should fail
		expect(result.text).toBe('FAILED');
	});
});
