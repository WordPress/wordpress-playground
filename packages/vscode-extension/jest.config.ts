/* eslint-disable */
export default {
	displayName: 'vscode-extension-vscode-extension',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]sx?$': [
			'ts-jest',
			{ tsconfig: '<rootDir>/tsconfig.spec.json' },
		],
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
	coverageDirectory:
		'../../coverage/packages/vscode-extension/vscode-extension',
};
