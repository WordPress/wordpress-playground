/**
 * The amdLoader below is executed in the WORDPRESS IFRAME, not in the
 * current environment. The function is stringified and included in the
 * rollup bundle to make all the define() calls work.
 *
 * Splutting the rollup bundle into separate modules is required for
 * the hot module reloading to work.
 */
export default function createAmdLoader({ cssUrlPrefix }) {
	// @TODO – fix the `Block "create-block/example-static" is already registered.`
	//         errors occuring when updating the index.js file.
	//         Technically we should wrap the factory in try {} finally {} and
	//         then refresh the page if it's not a React Component or a CSS file.
	//
	// @TODO – do not blindly eval the built bundle.
	//         instead, only eval the new bundle if an
	//         old one is already present. This could be
	//         an argument like below:
	//
	//             buildWordPressPlugin({ mode: 'init' })
	//             // ^ sets a global flag indicating the
	//             //   entrypoint id. Errors out if it's already present.
	//
	//             buildWordPressPlugin({ mode: 'refresh' })
	//             // ^ calls refreshDirtyModules().
	//             //   Errors out if the global flag isn't present.
	//
	// @TODO – refresh CSS files even if they're loaded directly
	//         and not as JS chunks. The { cssUrlPrefix } option
	//         could be helpful there. Technically the current CSS
	//         transform already does it, we just want to make sure
	//         to a) load the updated CSS in the same DOM location as the
	//         old one and b) allow CSS HMR even if the parent JS entrypoint
	//         isn't allowed to refresh.

	return (
		'(' +
		function () {
			if (!('define' in window)) {
				const global: any = window;
				global.__modules = {};
				global.__modulesMeta = {};
				global.define = function define(moduleName, deps, factory) {
					if (typeof deps === 'function') {
						factory = deps;
						deps = [];
					}
					const moduleKey = normalizeModuleKey(moduleName);
					global.__modulesMeta[moduleKey] = {
						deps,
						factory,
						dirty:
							!global.__modulesMeta[moduleKey] ||
							global.__modulesMeta[moduleKey].factory + '' !==
								factory + '',
					};
				};
				global.require = function require(moduleName) {
					const moduleKey = normalizeModuleKey(moduleName);
					if (!global.__modules[moduleKey]) {
						global.__modules[moduleKey] = loadModule(moduleKey);
					}

					return global.__modules[moduleKey];
				};
				global.reloadDirtyModules = function () {
					for (const moduleName in global.__modulesMeta) {
						const mod = global.__modulesMeta[moduleName];
						if (mod.dirty) {
							const exports = loadModule(moduleName);
							global.__modules[moduleName] = exports;

							if (global.isReactRefreshBoundary(exports)) {
								global.__enqueueReactUpdate();
							}
						}
					}
				};

				function normalizeModuleKey(moduleKey) {
					if (moduleKey.startsWith('./')) {
						moduleKey = moduleKey.substring('./'.length);
					}
					if (!moduleKey.endsWith('.js')) {
						moduleKey += '.js';
					}
					return moduleKey;
				}

				function loadModule(moduleName) {
					const meta = global.__modulesMeta[moduleName];
					if (!meta) {
						console.log(
							'global modules meta:',
							global.__modulesMeta
						);
						throw new Error(
							`Could not find module "${moduleName}"`
						);
					}
					if (meta.dirty) {
						meta.dirty = false;
					}

					let exportIsADependency = false;
					let exports = {};
					const deps = meta.deps.map((dep) => {
						if (dep === 'exports') {
							exportIsADependency = true;
							return exports;
						}
						return global.require(dep);
					});

					// React-fast-refresh support
					let prevRefreshReg = global.$RefreshReg$;
					let prevRefreshSig = global.$RefreshSig$;

					global.$RefreshReg$ = (type, id) => {
						const fullId = JSON.stringify(id) + ' ' + id;
						global.RefreshRuntime.register(type, fullId);
					};
					global.$RefreshSig$ =
						global.RefreshRuntime.createSignatureFunctionForTransform;

					// Run the module factory
					const result = meta.factory(...deps);
					if (!exportIsADependency) {
						exports = result;
					}

					global.$RefreshReg$ = prevRefreshReg;
					global.$RefreshSig$ = prevRefreshSig;

					return exports;
				}
			}
		} +
		')();'
	);
}
