export default function serviceWorkerVersionPlugin() {
	const virtualModuleId = 'virtual:service-worker-version';
	const resolvedVirtualModuleId = '\0' + virtualModuleId;

	return {
		name: 'my-plugin', // required, will show up in warnings and errors
		resolveId(id) {
			if (id === virtualModuleId) {
				return resolvedVirtualModuleId;
			}
		},
		load(id) {
			if (id === resolvedVirtualModuleId) {
                return `
                import serviceWorkerPath from './src/service-worker.ts?worker&url';
                let version;
                if(serviceWorkerPath.endsWith('.ts')) {
                    // Development mode, use a random string to force the service worker to update
                    version = Math.random()+''
                } else {
                    // Production mode, compute the service worker version based on the
                    // file name
                    version = serviceWorkerPath;
                }
                export default version;
                `;
			}
		},
	};
}
