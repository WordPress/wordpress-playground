import { UniversalPHP } from '@php-wasm/universal';
import { BaseStep } from '.';

export interface RunWpInstallationWizardStep extends BaseStep {
	step: 'runWpInstallationWizard';
	options: WordPressInstallationOptions;
}

export interface WordPressInstallationOptions {
	adminUsername?: string;
	adminPassword?: string;
}

/**
 * Installs WordPress
 *
 * @param playground The playground client.
 * @param options Installation options.
 */
export async function runWpInstallationWizard(
	playground: UniversalPHP,
	options: WordPressInstallationOptions
) {
	await playground.request({
		url: '/wp-admin/install.php?step=2',
		method: 'POST',
		formData: {
			language: 'en',
			prefix: 'wp_',
			weblog_title: 'My WordPress Website',
			user_name: options.adminPassword || 'admin',
			admin_password: options.adminPassword || 'password',
			admin_password2: options.adminPassword || 'password',
			Submit: 'Install WordPress',
			pw_weak: '1',
			admin_email: 'admin@localhost.com',
		},
	});
}
