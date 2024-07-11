import viteTsConfigPathsModule from 'vite-tsconfig-paths';
/**
 * vite-tsconfig-paths does exports one way as CJS and another as ESM.
 * This workaround allows us to use it in both contexts.
 *
 * @TODO: Remove this when vite-tsconfig-paths is fixed.
 *
 * Related issue: https://github.com/aleclarson/vite-tsconfig-paths/issues/75
 */
export const viteTsConfigPaths =
	typeof viteTsConfigPathsModule === 'function'
		? viteTsConfigPathsModule
		: ((viteTsConfigPathsModule as any)
				.default as typeof viteTsConfigPathsModule);
