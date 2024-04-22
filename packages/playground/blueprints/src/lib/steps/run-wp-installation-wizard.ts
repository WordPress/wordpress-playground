import { StepHandler } from '.';

/**
 * @private
 */
export interface RunWpInstallationWizardStep {
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
export const runWpInstallationWizard: StepHandler<
	RunWpInstallationWizardStep
> = async (playground, { options }) => {
	return await playground.request({
		url: '/wp-admin/install.php?step=2',
		method: 'POST',
		body: {
			language: 'en',
			prefix: 'wp_',
			weblog_title: 'My WordPress Website',
			user_name: options.adminPassword || 'admin',
			admin_password: options.adminPassword || 'password',
			// The installation wizard demands typing the same password twice
			admin_password2: options.adminPassword || 'password',
			Submit: 'Install WordPress',
			pw_weak: '1',
			admin_email: 'admin@localhost.com',
		},
	});
};
