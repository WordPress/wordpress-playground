import * as babel from '@babel/standalone';

export default () => [
	babel.availablePlugins['transform-react-jsx'],
	{
		pragma: 'window.wp.element.createElement',
		pragmaFrag: 'Fragment',
	},
];
