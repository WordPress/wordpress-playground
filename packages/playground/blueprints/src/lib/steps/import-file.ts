import { PHPResponse } from '@php-wasm/universal';
import { StepHandler } from '.';

/**
 * @inheritDoc importFile
 * @example
 *
 * <code>
 * {
 * 		"step": "importFile",
 * 		"file": {
 * 			"resource": "url",
 * 			"url": "https://your-site.com/starter-content.wxz"
 * 		}
 * }
 * </code>
 */
export interface ImportFileStep<ResourceType> {
	step: 'importFile';
	/** The file to import */
	file: ResourceType;
}

/**
 * Uploads a file to the WordPress importer and returns the response.
 * Supports both WXR and WXZ files.
 *
 * @see https://github.com/WordPress/wordpress-importer/compare/master...akirk:wordpress-importer:import-wxz.patch
 * @param playground Playground client.
 * @param file The file to import.
 */
export const importFile: StepHandler<ImportFileStep<File>> = async (
	playground,
	{ file },
	progress?
) => {
	progress?.tracker?.setCaption('Importing content');
	const importerPageOneResponse = await playground.request({
		url: '/wp-admin/admin.php?import=wordpress',
	});

	const firstUrlAction = DOM(importerPageOneResponse)
		.getElementById('import-upload-form')
		?.getAttribute('action');

	const stepOneResponse = await playground.request({
		url: `/wp-admin/${firstUrlAction}`,
		method: 'POST',
		body: { import: file },
	});

	// Map authors of imported posts to existing users
	const importForm = DOM(stepOneResponse).querySelector(
		'#wpbody-content form'
	) as HTMLFormElement;

	if (!importForm) {
		console.log(stepOneResponse.text);
		throw new Error(
			'Could not find an importer form in response. See the response text above for details.'
		);
	}

	const data = getFormData(importForm);
	data['fetch_attachments'] = '1';
	for (const key in data) {
		if (key.startsWith('user_map[')) {
			const newKey = 'user_new[' + key.slice(9, -1) + ']';
			data[newKey] = '1'; // Hardcoded admin ID for now
		}
	}

	const importResult = await playground.request({
		url: importForm.action,
		method: 'POST',
		body: data,
	});
	if (!importResult.text.includes('All done.')) {
		console.warn('WordPress response was: ', {
			text: importResult.text,
			errors: importResult.errors,
		});
		throw new Error('Import failed, see console for details.');
	}
};

function DOM(response: PHPResponse) {
	return new DOMParser().parseFromString(response.text, 'text/html');
}

function getFormData(form: HTMLFormElement): Record<string, string> {
	return Object.fromEntries((new FormData(form) as any).entries());
}
