import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config';

export default defineConfig((env) =>
	mergeConfig(
		config(env),
		defineConfig({
			define: {
				'process.env.PROTOCOL': JSON.stringify('https'),
			},
		})
	)
);
