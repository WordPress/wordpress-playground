import { UniversalPHP } from '@php-wasm/universal';
import { CompiledBlueprint } from './compile';

export async function runBlueprintSteps(
	compiledBlueprint: CompiledBlueprint,
	playground: UniversalPHP
) {
	await compiledBlueprint.run(playground);
}
