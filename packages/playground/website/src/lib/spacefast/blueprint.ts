import type {
	BlueprintV1Declaration,
	StepDefinition,
} from '@wp-playground/client';
import { dirname, joinPaths, phpVar } from '@php-wasm/util';
import type { SiteManifest } from './site';
import { publicFileUrl, SOURCE_DIRECTORY, uploadFilePath } from './paths';

export const RESTORE_MARKER = '<?php /* Restore saved Spacefast Playground */';

/** A regular Blueprint URL can recreate both the installation and its current data. */
export function createStoredBlueprint(
	setup: BlueprintV1Declaration,
	manifest: SiteManifest,
	publishedUrl: string,
	username: string
): BlueprintV1Declaration {
	const base = new URL(publishedUrl);
	const restore: StepDefinition[] = [
		{
			step: 'runPHP',
			code: `${RESTORE_MARKER}
			require '/wordpress/wp-load.php';
			file_put_contents('/tmp/spacefast-new-url.txt', site_url());
			$uploads = '/wordpress/wp-content/uploads';
			if (is_dir($uploads)) {
				$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploads,
					FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
				foreach ($files as $file) {
					if ($file->isDir() && !$file->isLink()) { rmdir($file->getPathname()); }
					else { unlink($file->getPathname()); }
				}
			}
			`,
		},
		{
			step: 'writeFile',
			path: '/tmp/spacefast-restore.sqlite',
			data: {
				resource: 'url',
				url: publicFileUrl(
					joinPaths(SOURCE_DIRECTORY, 'database.sqlite'),
					base
				).href,
			},
		},
		...manifest.uploads.flatMap((path): StepDefinition[] => {
			const target = joinPaths('/wordpress/wp-content/uploads', path);
			return [
				{ step: 'mkdir', path: dirname(target) },
				{
					step: 'writeFile',
					path: target,
					data: {
						resource: 'url',
						url: publicFileUrl(
							uploadFilePath(manifest.formatVersion, path),
							base
						).href,
					},
				},
			];
		}),
		{
			step: 'runPHP',
			code: `<?php
			$environment = require '/internal/shared/wp-env.php';
			if ($environment['db']['type'] !== 'sqlite') { throw new RuntimeException('This site requires SQLite.'); }
			$path = $environment['db']['path'];
			foreach (array($path . '-wal', $path . '-shm', $path) as $file) {
				if (file_exists($file) && !unlink($file)) { throw new RuntimeException('Could not replace database.'); }
			}
			if (!rename('/tmp/spacefast-restore.sqlite', $path)) { throw new RuntimeException('Could not restore database.'); }
			`,
		},
		{
			step: 'wp-cli',
			command: [
				'wp',
				'eval',
				`
				$new = file_get_contents('/tmp/spacefast-new-url.txt');
				WP_CLI::runcommand('search-replace ' . escapeshellarg(${phpVar(manifest.siteUrl)}) . ' ' . escapeshellarg($new) . ' --all-tables-with-prefix --precise', array('launch' => false));
				update_option('home', $new);
				update_option('siteurl', $new);
			`,
			],
		},
	];
	return {
		...setup,
		landingPage: '/wp-admin/',
		login: false,
		steps: [
			...(setup.steps || []),
			...restore,
			{ step: 'login', username },
		],
	};
}

/** Do not replay an older data restore when saving an already reopened Playground. */
export function getSetupSteps(blueprint: BlueprintV1Declaration) {
	const steps = blueprint.steps || [];
	const restoreIndex = steps.findIndex(
		(step) =>
			step &&
			typeof step === 'object' &&
			step.step === 'runPHP' &&
			typeof step.code === 'string' &&
			step.code.startsWith(RESTORE_MARKER)
	);
	return restoreIndex < 0 ? steps : steps.slice(0, restoreIndex);
}
