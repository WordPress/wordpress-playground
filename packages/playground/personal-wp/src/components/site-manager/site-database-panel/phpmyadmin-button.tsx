import { useEffect, useState } from 'react';
import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { external } from '@wordpress/icons';
import css from './style.module.css';
import {
	type PlaygroundClient,
	type StepDefinition,
	type UniversalPHP,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/client';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

const phpMyAdminUrl =
	'https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-english.zip';

async function installPhpMyAdmin(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	const phpMyAdminPath = `${documentRoot}/phpmyadmin`;

	const steps: StepDefinition[] = [
		{
			step: 'unzip',
			zipFile: {
				resource: 'url',
				url: phpMyAdminUrl,
			},
			extractToPath: documentRoot,
		},
		{
			step: 'mv',
			fromPath: `${documentRoot}/phpMyAdmin-5.2.3-english`,
			toPath: phpMyAdminPath,
		},
		{
			step: 'writeFile',
			path: `${phpMyAdminPath}/libraries/classes/Dbal/DbiMysqli.php`,
			data: (await import('./phpmyadmin-extensions/DbiMysqli.php?raw'))
				.default as string,
		},
		{
			step: 'writeFile',
			path: `${phpMyAdminPath}/config.inc.php`,
			data: (await import('./phpmyadmin-extensions/config.inc.php?raw'))
				.default as string,
		},
	];

	const blueprint = await compileBlueprintV1(
		{ steps },
		{ corsProxy: corsProxyUrl }
	);

	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
}

export function PhpMyAdminButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function detectPhpMyAdmin() {
			if (!playground) {
				return;
			}

			const documentRoot = await playground.documentRoot;
			const phpMyAdminPath = `${documentRoot}/phpmyadmin`;

			if (await playground.isDir(phpMyAdminPath)) {
				setState('ready');
			} else {
				setState('idle');
			}
		}
		detectPhpMyAdmin();
	}, [playground]);

	const handleOpenPhpMyAdmin = async () => {
		if (!playground) {
			return;
		}

		if (state === 'loading') {
			return;
		}

		if (state === 'idle') {
			setState('loading');
			try {
				await installPhpMyAdmin(playground);
				setState('ready');
			} catch (error) {
				setState('idle');
				setError(
					error instanceof Error ? error.message : 'Unknown error'
				);
				return;
			}
		}

		const playgroundUrl = await playground.absoluteUrl;
		if (playgroundUrl) {
			window.open(
				`${playgroundUrl}/phpmyadmin/index.php?route=/database/structure&db=wordpress`,
				'_blank',
				'noopener,noreferrer'
			);
		}
	};

	const isLoading = state === 'loading';
	return (
		<>
			<Flex direction="column" gap={0} expanded={false}>
				<Button
					variant="primary"
					disabled={!playground || isLoading}
					isBusy={isLoading}
					onClick={handleOpenPhpMyAdmin}
				>
					<Flex justify="space-between" gap={2} expanded={true}>
						<FlexItem>Open phpMyAdmin</FlexItem>
						<FlexItem>
							<Icon icon={external} size={16} />
						</FlexItem>
					</Flex>
				</Button>
			</Flex>
			{error && (
				<div className={css.error}>
					Failed to install phpMyAdmin. Please try again. Error:{' '}
					{error}
				</div>
			)}
		</>
	);
}
