interface AmdLoaderOptions {
	entrypoint: string;
	reloadOnly: boolean;
}

interface ModuleMeta {
	id: string;
	deps: string[];
	factory: (...args: any[]) => any;
	needsReloading?: boolean;
}

/**
 * The amdLoader below is executed in the WORDPRESS IFRAME, not in the
 * current environment. The function is stringified and included in the
 * rollup bundle to make all the define() calls work.
 *
 * Splutting the rollup bundle into separate modules is required for
 * the hot module reloading to work.
 */
export default function createAmdLoader(options: AmdLoaderOptions) {
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
	//         and not as JS chunks. The { assetsUrl } option
	//         could be helpful there. Technically the current CSS
	//         transform already does it, we just want to make sure
	//         to a) load the updated CSS in the same DOM location as the
	//         old one and b) allow CSS HMR even if the parent JS entrypoint
	//         isn't allowed to refresh.

	// Initial load:
	// Subsequent load:

	// ----

	// I load the bundle and want this to happen:
	// * If it is a JS bundle
	// 	 * If it is being loaded via <script src=""></script>, load it
	// 	 * Else, if it is being loaded via eval() now
	//	 	 * If it was already loaded via <script src=""></script>, reload it
	//		 * Otherwise, do nothing
	// * If it's a CSS bundle
	//   * If it is being loaded via <link rel="" /> or <style></style>, load it
	// 	 * Else, if it is being loaded via eval() now
	// 		 * If it was already loaded via <link rel="" /> or <style></style>, reload it
	// 		 * Otherwise, do nothing

	return (
		'(' +
		function ({ reloadOnly, entrypoint }) {
			const global: any = window;
			const isInitialLoad = !('define' in window);
			if (isInitialLoad) {
				global.__modules = {};
				global.__modulesMeta = {} as Record<string, ModuleMeta>;
				global.define = function define(moduleName, deps, factory) {
					if (typeof deps === 'function') {
						factory = deps;
						deps = [];
					}
					const id = normalizeModuleId(moduleName);
					const newModuleMeta: ModuleMeta = {
						id,
						deps,
						factory,
					};
					const loader = getLoader(id);
					newModuleMeta.needsReloading = loader.shouldInvalidate(
						newModuleMeta,
						global.__modulesMeta[id]
					);
					global.__modulesMeta[id] = newModuleMeta;
				};

				/**
				 * Returns the exports of the requested module.
				 * If the module was never initialized, calls the factory.
				 *
				 * Does not reload the modules redeclared with `define()` –
				 * use `reloadDirtyModules` for that.
				 *
				 * @param moduleName The name of the module to load.
				 * @return Requested module exports.
				 */
				global.require = function require(moduleName: string) {
					const moduleKey = normalizeModuleId(moduleName);
					if (!global.__modules[moduleKey]) {
						global.__modules[moduleKey] = loadModule(moduleKey);
					}

					return global.__modules[moduleKey];
				};

				/**
				 * Reloads the modules redeclared with `define()` after
				 * they were loaded.
				 */
				global.reloadDirtyModules = function () {
					for (const moduleName in global.__modulesMeta) {
						const mod = global.__modulesMeta[moduleName];
						if (mod.needsReloading) {
							// loadModule clears the dirty flag
							const exports = loadModule(moduleName);
							global.__modules[moduleName] = exports;

							if (global.isReactRefreshBoundary(exports)) {
								global.__enqueueReactUpdate();
							}
						}
					}
				};

				function normalizeModuleId(moduleKey) {
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
						throw new Error(
							`Could not find module "${moduleName}"`
						);
					}
					meta.needsReloading = false;
					return getLoader(moduleName).load(meta);
				}
			}

			function getLoader(id) {
				for (const loader of loaders) {
					if (id.match(loader.pattern)) {
						return loader;
					}
				}
				throw new Error(`No loader found for module "${id}".`);
			}

			const loaders = [
				{
					pattern: /\.css\.js$/,
					load(meta: ModuleMeta) {
						const { css, uniqueCssId } = runModuleFactory(meta);

						// Find all stylesheets with our unique CSS rule:
						const updatedStylesheet =
							document.createElement('style');
						updatedStylesheet.innerHTML = css;
						const stylesheets = this.styleSheetsWithSelector(
							`#${uniqueCssId}`
						);

						if (!stylesheets.length) {
							document.head.appendChild(updatedStylesheet);
							return;
						}

						// Replace the old stylesheet with the new one:
						if (stylesheets[0].ownerNode instanceof Element) {
							if (stylesheets[0].ownerNode.id) {
								updatedStylesheet.id =
									stylesheets[0].ownerNode.id;
							}
							stylesheets[0].ownerNode.parentNode!.insertBefore(
								updatedStylesheet,
								stylesheets[0].ownerNode
							);
						} else {
							document.head.appendChild(updatedStylesheet);
						}

						// Unload all the pre-existing copies of the current stylesheet:
						for (const stylesheet of stylesheets) {
							if (stylesheet.ownerNode) {
								stylesheet.ownerNode.remove();
							} else {
								this.deleteAllCssRules(stylesheet);
							}
						}
					},
					shouldInvalidate(newMeta) {
						const { uniqueZIndex, uniqueCssId } =
							runModuleFactory(newMeta);
						return this.isStyleSheetLoaded(
							uniqueCssId,
							uniqueZIndex
						);
					},
					isStyleSheetLoaded(
						uniqueCssId: string,
						uniqueZIndex: string
					) {
						const div = document.createElement('div');
						div.id = uniqueCssId;
						div.style.display = 'none';
						document.head.appendChild(div);
						const cssAlreadyLoaded =
							window.getComputedStyle(div).zIndex ===
							uniqueZIndex;
						div.remove();
						return cssAlreadyLoaded;
					},
					styleSheetsWithSelector(selector) {
						const stylesheets: Array<CSSStyleSheet> = [];
						for (const stylesheet of Array.from(
							document.styleSheets
						)) {
							for (const cssRule of Array.from(
								stylesheet.cssRules
							)) {
								if (
									cssRule instanceof CSSStyleRule &&
									cssRule.selectorText === selector
								) {
									stylesheets.push(stylesheet);
									break;
								}
							}
						}
						return stylesheets;
					},
					deleteAllCssRules(stylesheet: CSSStyleSheet) {
						// If there's no owner node, just remove all the stylesheet rules:
						for (
							let i = stylesheet.cssRules.length - 1;
							i >= 0;
							i--
						) {
							stylesheet.deleteRule(i);
						}
					},
				},
				{
					pattern: /\.js$/,
					load(meta: ModuleMeta) {
						// React-fast-refresh support
						let prevRefreshReg = global.$RefreshReg$;
						let prevRefreshSig = global.$RefreshSig$;

						global.$RefreshReg$ = (type, id) => {
							const fullId = JSON.stringify(id) + ' ' + id;
							global.RefreshRuntime.register(type, fullId);
						};
						global.$RefreshSig$ =
							global.RefreshRuntime.createSignatureFunctionForTransform;

						try {
							return runModuleFactory(meta);
						} finally {
							global.$RefreshReg$ = prevRefreshReg;
							global.$RefreshSig$ = prevRefreshSig;
						}
					},
					shouldInvalidate(newMeta, oldMeta) {
						// Only invalidate JS modules if they were
						// already loaded and the factory function has
						// changed.
						return (
							global.__modules[newMeta.id] &&
							newMeta.factory.toString() !==
								oldMeta.factory.toString()
						);
					},
				},
			];

			function runModuleFactory(meta: ModuleMeta): any {
				let exportIsADependency = false;

				let exports = {};
				const deps = meta.deps.map((dep) => {
					if (dep === 'exports') {
						exportIsADependency = true;
						return exports;
					}
					return global.require(dep);
				});
				const result = meta.factory(...deps);
				if (!exportIsADependency) {
					exports = result;
				}
				return exports;
			}

			setTimeout(() => {
				if (isInitialLoad) {
					if (reloadOnly) {
						global.reloadDirtyModules();
					} else {
						global.require(entrypoint);
					}
				} else {
					global.reloadDirtyModules();
				}
			});
		} +
		`)(${JSON.stringify(options)});`
	);
}
