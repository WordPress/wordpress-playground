import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';
import { Blueprint } from '../blueprint';

/**
 * @inheritDoc defineConstants
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "defineConstants",
 * 		"constants": {
 *          "WP_DEBUG": true
 *      }
 * }
 * </code>
 */
export interface DefineConstantsStep {
	step: 'defineConstants';
	/** The constants to define */
	constants: Record<string, unknown>;
}

/**
 * Defines PHP constants to be used in every request.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param constants
 */
export const defineConstants: StepHandler<DefineConstantsStep> = async (
	playground,
	{ constants }
) => {
	for (const key in constants) {
		await playground.defineConstant(key, constants[key] as string);
	}
};

/**
 * @deprecated Use defineConstants. This will be removed in one of the upcoming releaes.
 */
export function deprecatedDefineWpConfigConsts(
	playground: UniversalPHP,
	{ consts }: any
) {
	return defineConstants(playground, { constants: consts });
}

export function migrateDeprecatedJSONSteps(blueprint: Blueprint) {
	if (!blueprint.steps) {
		return blueprint;
	}
	return {
		...blueprint,
		steps: blueprint?.steps.map((step) => {
			if (
				typeof step === 'object' &&
				// @ts-ignore
				step?.step === 'defineWpConfigConsts'
			) {
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { consts, virtualize, ...rest } = step;
				return {
					...rest,
					step: 'defineConstants',
					// @ts-ignore
					constants: consts,
				};
			}
			return step;
		}),
	};
}
