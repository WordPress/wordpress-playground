import importGlobal from 'babel-plugin-import-global';

const noop = () => {};
type WPAssetCallback = (asset: string) => void;
export default function transpileWordPressImports(
	onWpAsset: WPAssetCallback = noop
) {
	return [
		importGlobal,
		{
			globals: (src) => {
				const map = {
					'@wordpress/a11y': 'wp.a11y',
					'@wordpress/api-fetch': 'wp.apiFetch',
					'@wordpress/autop': 'wp.autop',
					'@wordpress/blob': 'wp.blob',
					'@wordpress/block-directory': 'wp.blockDirectory',
					'@wordpress/block-editor': 'wp.blockEditor',
					'@wordpress/block-library': 'wp.blockLibrary',
					'@wordpress/block-serialization-default-parser':
						'wp.blockSerializationDefaultParser',
					'@wordpress/blocks': 'wp.blocks',
					'@wordpress/components': 'wp.components',
					'@wordpress/compose': 'wp.compose',
					'@wordpress/core-data': 'wp.coreData',
					'@wordpress/data': 'wp.data',
					'@wordpress/date': 'wp.date',
					'@wordpress/deprecated': 'wp.deprecated',
					'@wordpress/dom': 'wp.dom',
					'@wordpress/dom-ready': 'wp.domReady',
					'@wordpress/edit-navigation': 'wp.editNavigation',
					'@wordpress/edit-post': 'wp.editPost',
					'@wordpress/edit-site': 'wp.editSite',
					'@wordpress/edit-widgets': 'wp.editWidgets',
					'@wordpress/editor': 'wp.editor',
					'@wordpress/element': 'wp.element',
					'@wordpress/escape-html': 'wp.escapeHtml',
					'@wordpress/format-library': 'wp.formatLibrary',
					'@wordpress/hooks': 'wp.hooks',
					'@wordpress/html-entities': 'wp.htmlEntities',
					'@wordpress/i18n': 'wp.i18n',
					'@wordpress/is-shallow-equal': 'wp.isShallowEqual',
					'@wordpress/keyboard-shortcuts': 'wp.keyboardShortcuts',
					'@wordpress/keycodes': 'wp.keycodes',
					'@wordpress/nux': 'wp.nux',
					'@wordpress/plugins': 'wp.plugins',
					'@wordpress/preferences': 'wp.preferences',
					'@wordpress/preferences-persistence':
						'wp.preferencesPersistence',
					'@wordpress/primitives': 'wp.primitives',
					'@wordpress/reusable-blocks': 'wp.reusableBlocks',
					'@wordpress/rich-text': 'wp.richText',
					'@wordpress/shortcode': 'wp.shortcode',
					'@wordpress/url': 'wp.url',
					'@wordpress/viewport': 'wp.viewport',
					'@wordpress/warning': 'wp.warning',
					'@wordpress/widgets': 'wp.widgets',
					'@wordpress/wordcount': 'wp.wordcount',
				};
				onWpAsset(
					src
						.replace('@', '')
						.replace('/', '-')
						.replace('wordpress-', 'wp-')
				);
				return map[src];
			},
		},
	];
}
