import { Button } from '@wordpress/components';
import { useState, useEffect } from 'react';
import {
	type PlaygroundClient,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/client';
import type { StepDefinition } from '@wp-playground/client';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export function SiteDatabasePanel({
	playground,
	playgroundUrl,
	documentRoot,
}: {
	playground: PlaygroundClient | undefined;
	playgroundUrl: string | null;
	documentRoot: string | null;
}) {
	const [isAdminerReady, setIsAdminerReady] = useState(false);
	const [isPhpMyAdminReady, setIsPhpMyAdminReady] = useState(false);

	useEffect(() => {
		if (!playground || !documentRoot) {
			setIsAdminerReady(false);
			setIsPhpMyAdminReady(false);
			return;
		}

		async function checkOrInstallAdminer() {
			if (!playground || !documentRoot) {
				return;
			}
			const adminerPath = `${documentRoot}/adminer.php`;
			const pluginsPath = `${documentRoot}/adminer-plugins`;

			// Check if Adminer is already set up.
			const adminerExists = await playground.fileExists(adminerPath);
			const pluginsExists = await playground.fileExists(pluginsPath);
			if (adminerExists && pluginsExists) {
				setIsAdminerReady(true);
				return;
			}

			// Install Adminer and plugins using Blueprint steps.
			try {
				const steps: StepDefinition[] = [];

				if (!adminerExists) {
					steps.push({
						step: 'writeFile',
						path: adminerPath,
						data: {
							resource: 'url',
							url: 'https://github.com/vrana/adminer/releases/download/v5.4.1/adminer-5.4.1-mysql-en.php',
						},
					});
				}

				if (!pluginsExists) {
					steps.push({ step: 'mkdir', path: pluginsPath });

					const plugins = import.meta.glob('./adminer-plugins/*', {
						as: 'raw',
						eager: true,
					});
					const files: Record<string, string> = {};
					for (const [srcPath, content] of Object.entries(plugins)) {
						const fileName = srcPath.split('/').pop()!;
						files[fileName] = content;
					}

					if (Object.entries(files).length > 0) {
						steps.push({
							step: 'writeFiles',
							writeToPath: pluginsPath,
							filesTree: {
								resource: 'literal:directory',
								name: 'adminer-plugins',
								files: files,
							},
						});
					}
				}

				if (steps.length > 0) {
					const blueprint = await compileBlueprintV1(
						{ steps },
						{ corsProxy: corsProxyUrl }
					);

					await runBlueprintV1Steps(blueprint, playground);
				}

				setIsAdminerReady(true);
			} catch (error) {
				console.error('Failed to install Adminer:', error);
				setIsAdminerReady(false);
			}
		}

		async function checkOrInstallPhpMyAdmin() {
			if (!playground || !documentRoot) {
				return;
			}
			const phpMyAdminPath = `${documentRoot}/phpmyadmin`;

			// Check if phpMyAdmin is already installed.
			const phpMyAdminExists = await playground.fileExists(
				phpMyAdminPath
			);
			if (phpMyAdminExists) {
				setIsPhpMyAdminReady(true);
				return;
			}

			// Install phpMyAdmin using Blueprint steps.
			try {
				const steps: StepDefinition[] = [
					// Extract phpMyAdmin zip file
					{
						step: 'unzip',
						zipFile: {
							resource: 'url',
							url: 'https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-english.zip',
						},
						extractToPath: documentRoot,
					},
					// Move the extracted folder to the final location
					{
						step: 'mv',
						fromPath: `${documentRoot}/phpMyAdmin-5.2.3-english`,
						toPath: phpMyAdminPath,
					},
				];

				// Add custom configuration and WP_SQLite_Driver integration
				const extensions = import.meta.glob(
					'./phpmyadmin-extensions/*',
					{
						as: 'raw',
						eager: true,
					}
				);

				// Write each extension file to the appropriate location
				for (const [srcPath, content] of Object.entries(extensions)) {
					const fileName = srcPath.split('/').pop()!;

					// Determine the target path based on the file
					let targetPath: string;
					if (fileName === 'DbiMysqli.php') {
						// Override phpMyAdmin's DBI implementation
						targetPath = `${phpMyAdminPath}/libraries/classes/Dbal/${fileName}`;
					} else {
						// Other files go to phpMyAdmin root (e.g., config.inc.php)
						targetPath = `${phpMyAdminPath}/${fileName}`;
					}

					steps.push({
						step: 'writeFile',
						path: targetPath,
						data: content,
					});
				}

				const blueprint = await compileBlueprintV1(
					{ steps },
					{ corsProxy: corsProxyUrl }
				);

				await runBlueprintV1Steps(blueprint, playground);

				setIsPhpMyAdminReady(true);
			} catch (error) {
				console.error('Failed to install phpMyAdmin:', error);
				setIsPhpMyAdminReady(false);
			}
		}

		void checkOrInstallAdminer();
		void checkOrInstallPhpMyAdmin();
	}, [playground, documentRoot]);

	const handleOpenAdminer = () => {
		if (playgroundUrl) {
			window.open(
				`${playgroundUrl}/adminer.php`,
				'_blank',
				'noopener,noreferrer'
			);
		}
	};

	const handleOpenPhpMyAdmin = () => {
		if (playgroundUrl) {
			window.open(
				`${playgroundUrl}/phpmyadmin/index.php?route=/database/structure&db=wordpress`,
				'_blank',
				'noopener,noreferrer'
			);
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
			<Button
				variant="primary"
				disabled={!playground || !isAdminerReady}
				onClick={handleOpenAdminer}
			>
				Adminer
			</Button>
			<Button
				variant="primary"
				disabled={!playground || !isPhpMyAdminReady}
				onClick={handleOpenPhpMyAdmin}
			>
				phpMyAdmin
			</Button>
		</div>
	);
}
