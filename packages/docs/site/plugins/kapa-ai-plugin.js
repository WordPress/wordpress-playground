export default function kapaAiPlugin(context, options) {
	return {
		name: 'kapa-ai-plugin',
		injectHtmlTags({ content }) {
			// Get the current locale from the content metadata
			const locale =
				content?.metadata?.locale ||
				context.i18n.currentLocale ||
				context.i18n.defaultLocale;

			// Map Docusaurus locales to Kapa AI language codes
			// See https://docs.kapa.ai/integrations/website-widget/configuration#supported-languages
			const localeMap = {
				en: 'en',
				es: 'es',
				fr: 'fr',
				ja: 'ja',
				'pt-br': 'pt',
				tl: 'en',
				gu: 'en',
			};

			const language = localeMap[locale] || 'en';
			const kapaAiConfig = {
				src: 'https://widget.kapa.ai/kapa-widget.bundle.js',
				'data-website-id': '50db26d1-afa4-4a5c-992d-695fa98588d2',
				'data-project-name': 'WordPress Playground',
				'data-project-color': '#FFFFFF',
				'data-project-logo':
					'https://wordpress.github.io/wordpress-playground/img/playground-logo.svg',
				'data-bot-protection-mechanism': 'hcaptcha',
				'data-modal-title': 'WordPress Playground AI Assistant',
				'data-modal-example-questions-title': 'Try asking me...',
				'data-modal-disclaimer':
					'This **AI assistant answers WordPress Playground questions** using the [documentation](https://wordpress.github.io/wordpress-playground/) and [github issues](https://github.com/WordPress/wordpress-playground/issues) from last year',
				'data-modal-example-questions':
					'How to use Blueprints API?,How to change PHP version?,How to import a WXR file?,How to mount local files?',
				'data-button-text-color': '#000000',
				'data-hyperlink-color': '#3996e3',
				'data-button-hide': 'true', // Hide the default bottom right button
				'data-language': language,
				async: true,
			};

			return {
				headTags: [
					{
						tagName: 'script',
						attributes: kapaAiConfig,
					},
				],
			};
		},
	};
}
