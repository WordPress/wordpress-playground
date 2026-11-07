import { defineConfig } from 'vite';
import config from './vite.config';

/**
 * For tests that must load the Asyncify PHP build.
 *
 * loadNodeRuntime() loads the JSPI build whenever Node.js supports JSPI.
 * Node.js enables JSPI by default from 24.20.0, and it can't be turned off,
 * so these tests need an older Node.js version.
 */
export default defineConfig((env) => {
	if ('Suspending' in WebAssembly) {
		throw new Error(
			`Node.js ${process.version} enables JSPI, so PHP would load the JSPI ` +
				'build instead of Asyncify. Run these tests with Node.js 24.18 or ' +
				'24.19, for example after `nvm install 24.18.0`.'
		);
	}
	return config(env);
});
