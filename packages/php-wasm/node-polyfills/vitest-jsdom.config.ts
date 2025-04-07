/// <reference types='vitest' />
import config from './vite.config';

export default {
	...config,
	test: {
		...config.test,
		environment: 'jsdom',
		setupFiles: ['../../../vitest.setup.ts'],
	},
};
