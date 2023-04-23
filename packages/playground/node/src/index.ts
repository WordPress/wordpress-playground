import {
	applyWordPressPatches,
	Blueprint,
	compileBlueprint,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { PlaygroundClient } from '@wp-playground/remote';
import { NodePHP } from '@php-wasm/node';

export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
} from '@php-wasm/universal';

export type { PlaygroundClient };
export interface NodePlaygroundOptions {
	blueprint?: Blueprint;
	wordpressPathOnHost: string;
	serverUrl: string;
}

export async function startNodePlayground(
	options: NodePlaygroundOptions
): Promise<NodePHP> {
	const blueprint: Blueprint = {
		...(options.blueprint || {}),
		preferredVersions: {
			php: '8.0',
			wp: 'latest',
			...(options.blueprint?.preferredVersions || {}),
		},
	};
	const compiled = compileBlueprint(blueprint);
	const playground = await NodePHP.load(compiled.versions.php, {
		requestHandler: {
			documentRoot: options.wordpressPathOnHost,
			absoluteUrl: options.serverUrl,
		},
	});

	await applyWordPressPatches(playground, {
		siteUrl: options.serverUrl,
		wordpressPath: options.wordpressPathOnHost,
	});

	await runBlueprintSteps(compiled, playground);
	return playground;
}
