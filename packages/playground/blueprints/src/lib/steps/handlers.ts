export { activatePlugin } from './activate-plugin';
export { applyWordPressPatches } from './apply-wordpress-patches';
export {
	rm,
	cp,
	mkdir,
	rmdir,
	mv,
	setPhpIniEntry,
	runPHP,
	runPHPWithOptions,
	request,
	writeFile,
} from './client-methods';
export { defineSiteUrl } from './define-site-url';
export { importFile, unzip, replaceSite, zipEntireSite } from './import-export';
export { installPlugin } from './install-plugin';
export { installTheme } from './install-theme';
export { login } from './login';
export { runWpInstallationWizard } from './run-wp-installation-wizard';
export { setSiteOptions, updateUserMeta } from './site-data';
