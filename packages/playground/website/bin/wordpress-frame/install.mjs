import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Use the production release installer for preview and release-switching browser tests. */
export function installLocalRelease(
	upload,
	webRoot,
	appOrigin,
	wordPressOrigin
) {
	execFileSync(
		'bash',
		[
			fileURLToPath(
				new URL(
					'../../../website-deployment/apply-update.sh',
					import.meta.url
				)
			),
			appOrigin,
			wordPressOrigin,
			upload,
			webRoot,
			`${webRoot}-backups`,
		],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				PLAYGROUND_LOCAL_RELEASES: '1',
				SITE_PHP: 'php',
				SITE_API_BASE: 'http://localhost',
				PLAYGROUND_MIME_TYPES: fileURLToPath(
					new URL(
						'../../../../php-wasm/universal/src/lib/mime-types.json',
						import.meta.url
					)
				),
			},
		}
	);
}
