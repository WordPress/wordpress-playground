import type { PlaygroundAPI } from '../app';
import { asDOM } from './common';

export async function installTheme(
	playground: PlaygroundAPI,
	themeZipFile: File,
	options: any = {}
) {
	const activate = 'activate' in options ? options.activate : true;

	// Upload it to WordPress
	const themeForm = await playground.request({
		relativeUrl: '/wp-admin/theme-install.php'
	});
	const themeFormPage = asDOM(themeForm);
	const themeFormData = new FormData(
		themeFormPage.querySelector('.wp-upload-form')! as HTMLFormElement
	) as any;
	const { themezip, ...postData } = Object.fromEntries(
		themeFormData.entries()
	);

	const themeInstalledResponse = await playground.request({
		relativeUrl: '/wp-admin/update.php?action=upload-theme',
		method: 'POST',
		formData: postData,
		files: { themezip: themeZipFile },
	});

	// Activate if needed
	if (activate) {
		const themeInstalledPage = asDOM(themeInstalledResponse);

		const messageContainer = themeInstalledPage.querySelector(
			'#wpbody-content > .wrap'
		);
		if (
			messageContainer?.textContent?.includes(
				'Theme installation failed.'
			)
		) {
			console.error(messageContainer?.textContent);
			return;
		}

		const activateButton = themeInstalledPage.querySelector(
			'#wpbody-content .activatelink, ' +
				'.update-from-upload-actions .button.button-primary'
		);
		if (!activateButton) {
			console.error('The "activate" button was not found.');
			return;
		}

		const activateButtonHref =
			activateButton.attributes.getNamedItem('href')!.value;
		const activateThemeUrl = new URL(
			activateButtonHref,
			await playground.pathToInternalUrl('/wp-admin/')
		).toString();
		await playground.request({
			absoluteUrl: activateThemeUrl,
		});
	}
}
