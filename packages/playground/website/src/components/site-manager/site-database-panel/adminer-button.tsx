import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { external } from '@wordpress/icons';
import { useEffect, useState } from 'react';
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

const adminerUrl =
	'https://github.com/vrana/adminer/releases/download/v5.4.1/adminer-5.4.1-mysql-en.php';

async function installAdminer(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	const adminerPath = `${documentRoot}/adminer/`;

	const steps: StepDefinition[] = [
		{ step: 'mkdir', path: adminerPath },
		{
			step: 'writeFile',
			path: `${adminerPath}/adminer.php`,
			data: {
				resource: 'url',
				url: adminerUrl,
			},
		},
		{
			step: 'writeFile',
			path: `${adminerPath}/adminer-mysql-on-sqlite-driver.php`,
			data: (
				await import('./adminer-extensions/adminer-mysql-on-sqlite-driver.php?raw')
			).default as string,
		},
		{
			step: 'writeFile',
			path: `${adminerPath}/index.php`,
			data: (await import('./adminer-extensions/index.php?raw'))
				.default as string,
		},
	];

	const blueprint = await compileBlueprintV1(
		{ steps },
		{ corsProxy: corsProxyUrl }
	);

	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
}

export function AdminerButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function detectAdminer() {
			if (!playground) {
				return;
			}

			const documentRoot = await playground.documentRoot;
			const adminerPath = `${documentRoot}/adminer`;

			if (await playground.isDir(adminerPath)) {
				setState('ready');
			} else {
				setState('idle');
			}
		}
		detectAdminer();
	}, [playground]);

	const handleOpenAdminer = async () => {
		if (!playground) {
			return;
		}

		if (state === 'loading') {
			return;
		}

		if (state === 'idle') {
			setState('loading');
			try {
				await installAdminer(playground);
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
				`${playgroundUrl}/adminer/`,
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
					onClick={handleOpenAdminer}
				>
					<Flex justify="space-between" gap={2} expanded={true}>
						<FlexItem>Open Adminer</FlexItem>
						<FlexItem>
							<Icon icon={external} size={16} />
						</FlexItem>
					</Flex>
				</Button>
			</Flex>
			{error && (
				<div className={css.error}>
					Failed to install Adminer. Please try again. Error: {error}
				</div>
			)}
		</>
	);
}
