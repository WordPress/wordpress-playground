import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { external } from '@wordpress/icons';
import { useState } from 'react';
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
	const adminerPath = `${documentRoot}/adminer.php`;
	const pluginsPath = `${documentRoot}/adminer-plugins`;

	const steps: StepDefinition[] = [
		{
			step: 'writeFile',
			path: adminerPath,
			data: {
				resource: 'url',
				url: adminerUrl,
			},
		},
		{ step: 'mkdir', path: pluginsPath },
	];

	const plugins = import.meta.glob<string>('./adminer-plugins/*', {
		eager: true,
		query: '?raw',
		import: 'default',
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
				console.error('Failed to install Adminer:', error);
				setState('idle');
				return;
			}
		}

		const playgroundUrl = await playground.absoluteUrl;
		if (playgroundUrl) {
			window.open(
				`${playgroundUrl}/adminer.php`,
				'_blank',
				'noopener,noreferrer'
			);
		}
	};

	const isLoading = state === 'loading';
	return (
		<Button
			variant="primary"
			disabled={!playground || isLoading}
			isBusy={isLoading}
			onClick={handleOpenAdminer}
		>
			<Flex justify="space-between" gap={2} expanded={true}>
				<FlexItem>
					{isLoading ? 'Opening Adminer…' : 'Open in Adminer'}
				</FlexItem>
				<FlexItem>
					<Icon icon={external} size={16} />
				</FlexItem>
			</Flex>
		</Button>
	);
}
