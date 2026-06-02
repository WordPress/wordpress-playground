const path = require('path');
const typedocApiPlugin = require('docusaurus-plugin-typedoc-api');

const typedocPackageRoot = path.dirname(
	require.resolve('docusaurus-plugin-typedoc-api/package.json')
);

const componentMap = new Map(
	['ApiPage', 'ApiIndex', 'ApiItem', 'ApiChangelog'].map((name) => [
		path.join(typedocPackageRoot, `lib/components/${name}.js`),
		path.join(__dirname, `../src/typedoc/${name}.tsx`),
	])
);

function remapComponent(componentPath) {
	if (!componentPath) {
		return componentPath;
	}

	const normalized = path.normalize(componentPath);
	for (const [original, replacement] of componentMap.entries()) {
		if (normalized === original) {
			return replacement;
		}
	}

	return componentPath;
}

function remapRoutes(routes) {
	if (!routes) {
		return routes;
	}

	return routes.map(remapRoute);
}

function remapRoute(route) {
	if (!route) {
		return route;
	}

	return {
		...route,
		component: remapComponent(route.component),
		routes: remapRoutes(route.routes),
	};
}

module.exports = function typedocApiWrapper(context, options) {
	const plugin = typedocApiPlugin(context, options);
	const originalContentLoaded = plugin.contentLoaded?.bind(plugin);

	return {
		...plugin,
		async contentLoaded(args) {
			if (!originalContentLoaded) {
				return;
			}

			const patchedActions = {
				...args.actions,
				addRoute(routeConfig) {
					return args.actions.addRoute(remapRoute(routeConfig));
				},
			};

			return originalContentLoaded({
				...args,
				actions: patchedActions,
			});
		},
	};
};
