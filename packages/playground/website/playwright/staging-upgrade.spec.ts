import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// Contract: a bad baseline exits before browser sessions or deployments start.
// Aggregating this prerequisite like later browser assertions can deploy over
// the wrong release and make the final rollback wait for an impossible state.
it.each([200, 503])(
	'aborts the staging rehearsal on baseline HTTP %s',
	async (status) => {
		const server = createServer((_request, response) => {
			response.writeHead(status, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify({ release: 'existing-release' }));
		});
		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('Expected TCP listener');
		try {
			await expect(
				promisify(execFile)(
					process.execPath,
					[
						fileURLToPath(
							new URL(
								'../../website-deployment/test-staging-upgrade.mjs',
								import.meta.url
							)
						),
						'staging-fixture',
						`http://127.0.0.1:${address.port}`,
						'http://wordpress.test',
					],
					{
						env: {
							...process.env,
							PLAYGROUND_STAGING_CONFIRM: 'staging-fixture',
						},
						timeout: 5000,
					}
				)
			).rejects.toMatchObject({
				code: 1,
				killed: false,
				stderr: expect.stringContaining(
					'The staging upgrade rehearsal requires trunk'
				),
			});
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	}
);
