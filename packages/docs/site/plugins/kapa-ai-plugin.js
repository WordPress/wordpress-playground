// Default translation messages
const defaultMessages = {
	'kapaAi.modalTitle': {
		message: 'WordPress Playground AI Assistant',
		description: 'Title for Kapa AI modal',
	},
	'kapaAi.exampleQuestionsTitle': {
		message: 'Try asking me...',
		description: 'Title for example questions section',
	},
	'kapaAi.disclaimer': {
		message:
			'This **AI assistant answers WordPress Playground questions** using the [documentation](https://wordpress.github.io/wordpress-playground/) and [github issues](https://github.com/WordPress/wordpress-playground/issues) from last year',
		description: 'Disclaimer text for Kapa AI',
	},
	'kapaAi.exampleQuestions': {
		message:
			'How to use Blueprints API?,How to change PHP version?,How to import a WXR file?,How to mount local files?',
		description: 'Example questions for Kapa AI',
	},
};

export default function kapaAiPlugin(context, options) {
	const { i18n } = context;

	// Store translated content per locale
	const translationsCache = {};

	/**
	 * Get translated messages for a locale
	 */
	function getTranslatedMessages(locale) {
		// Return cached if available
		if (translationsCache[locale]) {
			return translationsCache[locale];
		}

		// Return defaults if not in cache
		return {
			modalTitle: defaultMessages['kapaAi.modalTitle'].message,
			exampleQuestionsTitle:
				defaultMessages['kapaAi.exampleQuestionsTitle'].message,
			disclaimer: defaultMessages['kapaAi.disclaimer'].message,
			exampleQuestions:
				defaultMessages['kapaAi.exampleQuestions'].message,
		};
	}

	return {
		name: 'kapa-ai-plugin',

		getDefaultCodeTranslationMessages() {
			return defaultMessages;
		},

		getTranslationFiles() {
			return [
				{
					path: 'kapa-ai',
					content: defaultMessages,
				},
			];
		},

		translateContent({ content, translationFiles }) {
			// Extract translations from the translation files
			const kapaTranslations = translationFiles.find(
				(f) => f.path === 'kapa-ai'
			)?.content;

			if (kapaTranslations) {
				// Determine the current locale being processed
				const currentLocale =
					content?.metadata?.locale || i18n.currentLocale;

				// Store translations for this locale
				translationsCache[currentLocale] = {
					modalTitle:
						kapaTranslations['kapaAi.modalTitle']?.message ||
						defaultMessages['kapaAi.modalTitle'].message,
					exampleQuestionsTitle:
						kapaTranslations['kapaAi.exampleQuestionsTitle']
							?.message ||
						defaultMessages['kapaAi.exampleQuestionsTitle'].message,
					disclaimer:
						kapaTranslations['kapaAi.disclaimer']?.message ||
						defaultMessages['kapaAi.disclaimer'].message,
					exampleQuestions:
						kapaTranslations['kapaAi.exampleQuestions']?.message ||
						defaultMessages['kapaAi.exampleQuestions'].message,
				};
			}

			return content;
		},

		injectHtmlTags({ content }) {
			// Get the current locale from the content metadata
			const locale =
				content?.metadata?.locale ||
				i18n.currentLocale ||
				i18n.defaultLocale;

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

			// Get translated messages for this locale
			const translatedConfig = getTranslatedMessages(locale);

			const kapaAiConfig = {
				src: 'https://widget.kapa.ai/kapa-widget.bundle.js',
				'data-website-id': '50db26d1-afa4-4a5c-992d-695fa98588d2',
				'data-project-name': 'WordPress Playground',
				'data-project-color': '#FFFFFF',
				'data-project-logo':
					'https://wordpress.github.io/wordpress-playground/img/playground-logo.svg',
				'data-bot-protection-mechanism': 'hcaptcha',
				'data-modal-title': translatedConfig.modalTitle,
				'data-modal-example-questions-title':
					translatedConfig.exampleQuestionsTitle,
				'data-modal-disclaimer': translatedConfig.disclaimer,
				'data-modal-example-questions':
					translatedConfig.exampleQuestions,
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
