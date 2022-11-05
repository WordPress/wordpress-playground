module.exports = {
	env: {
		browser: true,
		es2021: true,
	},
	settings: {
		react: {
			version: '999.99.99', // Prevent eslint from complaining (we don't use react).
		},
		jsdoc: {
			tagNamePreference: {
				return: 'returns',
				internal: 'internal',
			},
		},
	},
	extends: [
		'eslint:recommended',
		'plugin:@wordpress/eslint-plugin/recommended',
		'plugin:react/recommended',
	],
	overrides: [],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: ['react'],
	rules: {
		'no-inner-declaration': 0,
		'no-use-before-define': 'off',
		'react/prop-types': 0,
		'no-console': 0,
		'no-empty': 0,
		'no-async-promise-executor': 0,
		'no-constant-condition': 0,
		'no-nested-ternary': 0,
		'jsx-a11y/click-events-have-key-events': 0,
		'jsx-a11y/no-static-element-interactions': 0,
	},
};
