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
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		if (!playground || !documentRoot) {
			setIsReady(false);
			return;
		}

		async function checkOrInstallAdminer() {
			if (!playground || !documentRoot) {
				return;
			}
			const adminerPath = `${documentRoot}/adminer.php`;

			// Check if Adminer is already set up.
			const adminerExists = await playground.fileExists(adminerPath);
			if (adminerExists) {
				setIsReady(true);
				return;
			}

			// Install Adminer using Blueprint steps.
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

				if (steps.length > 0) {
					const blueprint = await compileBlueprintV1(
						{ steps },
						{ corsProxy: corsProxyUrl }
					);

					await runBlueprintV1Steps(blueprint, playground);
				}

				setIsReady(true);
			} catch (error) {
				console.error('Failed to install Adminer:', error);
				setIsReady(false);
			}
		}

		void checkOrInstallAdminer();
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

	return (
		<Button
			variant="primary"
			disabled={!playground || !isReady}
			onClick={handleOpenAdminer}
		>
			Adminer
		</Button>
	);
}
