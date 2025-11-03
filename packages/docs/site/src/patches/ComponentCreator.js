import React from 'react';
import Loadable from 'react-loadable';
import routesChunkNames from '@generated/routesChunkNames';
import registry from '@generated/registry';
import Loading from '@theme/Loading';
import flat from '@docusaurus/core/lib/client/flat.js';
import { RouteContextProvider } from '@docusaurus/core/lib/client/routeContext.js';

function assignModuleExports(chunk, loadedModule) {
	if (typeof chunk !== 'object' && typeof chunk !== 'function') {
		return;
	}
	Object.keys(loadedModule)
		.filter((key) => key !== 'default')
		.forEach((key) => {
			const descriptor = Object.getOwnPropertyDescriptor(chunk, key);
			if (descriptor && !(descriptor.writable || descriptor.set)) {
				return;
			}
			try {
				chunk[key] = loadedModule[key];
			} catch (error) {
				if (process.env.NODE_ENV !== 'production') {
					console.warn(
						`[@docusaurus/ComponentCreator] Unable to assign exported property "${key}" to chunk.`,
						error
					);
				}
			}
		});
}

export default function ComponentCreator(path, hash) {
	if (path === '*') {
		return Loadable({
			loading: Loading,
			loader: () => import('@theme/NotFound'),
			modules: ['@theme/NotFound'],
			webpack: () => [require.resolveWeak('@theme/NotFound')],
			render(loaded, props) {
				const NotFound = loaded.default;
				return (
					<RouteContextProvider
						value={{ plugin: { name: 'native', id: 'default' } }}
					>
						<NotFound {...props} />
					</RouteContextProvider>
				);
			},
		});
	}

	const chunkNames = routesChunkNames[`${path}-${hash}`];
	const loader = {};
	const modules = [];
	const optsWebpack = [];
	const flatChunkNames = flat(chunkNames);

	Object.entries(flatChunkNames).forEach(([keyPath, chunkName]) => {
		const chunkRegistry = registry[chunkName];
		if (chunkRegistry) {
			loader[keyPath] = chunkRegistry[0];
			modules.push(chunkRegistry[1]);
			optsWebpack.push(chunkRegistry[2]);
		}
	});

	return Loadable.Map({
		loading: Loading,
		loader,
		modules,
		webpack: () => optsWebpack,
		render(loaded, props) {
			const loadedModules = JSON.parse(JSON.stringify(chunkNames));
			Object.entries(loaded).forEach(([keyPath, loadedModule]) => {
				const chunk = loadedModule.default;
				if (!chunk) {
					throw new Error(
						`The page component at ${path} doesn't have a default export. This makes it impossible to render anything. Consider default-exporting a React component.`
					);
				}
				assignModuleExports(chunk, loadedModule);
				let val = loadedModules;
				const keyPaths = keyPath.split('.');
				keyPaths.slice(0, -1).forEach((k) => {
					val = val[k];
				});
				val[keyPaths[keyPaths.length - 1]] = chunk;
			});

			const Component = loadedModules.__comp;
			delete loadedModules.__comp;
			const routeContext = loadedModules.__context;
			delete loadedModules.__context;
			const routeProps = loadedModules.__props;
			delete loadedModules.__props;

			return (
				<RouteContextProvider value={routeContext}>
					<Component {...loadedModules} {...routeProps} {...props} />
				</RouteContextProvider>
			);
		},
	});
}
