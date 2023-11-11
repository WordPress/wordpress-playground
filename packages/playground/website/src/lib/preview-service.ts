import { unzip } from '@wp-playground/blueprints';
import { activatePlugin } from '@wp-playground/blueprints';
import { login } from '@wp-playground/blueprints';
import { rm } from '@wp-playground/blueprints';

type previewData = {
	preloader: ArrayBuffer;
	postloader: ArrayBuffer;
	zipPackage: ArrayBuffer;
	plugin: ArrayBuffer;
	username: string;
	fakepass: string;
	pluginName: string;
};

export class PreviewService {
	static preloader: ArrayBuffer | null;
	static postloader: ArrayBuffer | null;
	static zipPackage: ArrayBuffer | null;
	static plugin: ArrayBuffer | null;
	static pluginName: string | null;
	static username: string | null;
	static fakepass: string | null;
	static hasPreview: boolean | null;

	static listen() {
		if (window.parent) {
			window.parent.postMessage(
				{ type: 'preview-service-listening' },
				new URL(document.referrer).origin
			);
		}

		const listenForPreview = (event: MessageEvent) => {
			if (event.data?.type !== 'collector-zip-package') {
				return;
			}
			PreviewService.setPreview(event.data);
			window.removeEventListener('message', listenForPreview);
		};

		window.addEventListener('message', listenForPreview);
	}

	static setPreview(previewData: previewData) {
		this.preloader = previewData.preloader;
		this.postloader = previewData.postloader;
		this.zipPackage = previewData.zipPackage;
		this.pluginName = previewData.pluginName;
		this.username = previewData.username;
		this.fakepass = previewData.fakepass;
		this.plugin = previewData.plugin;
		this.hasPreview = true;
	}

	static clearPreview() {
		if (!this.hasPreview) {
			return;
		}
		this.preloader = null;
		this.postloader = null;
		this.zipPackage = null;
		this.pluginName = null;
		this.username = null;
		this.fakepass = null;
		this.plugin = null;
		this.hasPreview = false;
	}

	static installPreview(playground: any) {
		const preloader = this.preloader
			? new Uint8Array(this.preloader)
			: 'Loading Resources...';
		const postloader = this.postloader
			? new Uint8Array(this.postloader)
			: 'Activating Plugin...';
		const zipPackage = this.zipPackage;
		const pluginName = this.pluginName;
		const username = this.username;
		const fakepass = this.fakepass;
		const plugin = this.plugin;

		PreviewService.clearPreview();

		if (!zipPackage) {
			return Promise.resolve();
		}

		return playground
			.writeFile('/wordpress/collector-loading.html', preloader)
			.then(() =>
				playground.writeFile(
					'/wordpress/collector-activate.html',
					postloader
				)
			)
			.then(() => playground.goTo(`/collector-loading.html`))
			.then(() =>
				playground.writeFile(
					'/tmp/690013d3-b53b-43f2-8371-b293a3bdc4fb',
					''
				)
			)
			.then(() =>
				playground.writeFile(
					'/wordpress/data.zip',
					new Uint8Array(zipPackage)
				)
			)
			.then(() =>
				unzip(playground, {
					zipPath: '/wordpress/data.zip',
					extractToPath: '/wordpress',
				})
			)
			.then(() => playground.goTo(`/collector-activate.html`))
			.then(() =>
				activatePlugin(playground, {
					pluginName: 'Collector',
					pluginPath: '/wordpress/wp-content/plugins/Collector',
				})
			)
			.then(() => {
				if (plugin && pluginName) {
					return playground
						.writeFile('/plugin.zip', new Uint8Array(plugin))
						.then(() =>
							unzip(playground, {
								extractToPath: '/wordpress/wp-content/plugins',
								zipPath: '/plugin.zip',
							})
						)
						.then(() =>
							activatePlugin(playground, {
								pluginPath:
									'/wordpress/wp-content/plugins/' +
									pluginName,
								pluginName,
							})
						);
				} else {
					return Promise.resolve();
				}
			})
			.then(() =>
				login(playground, {
					username: String(username),
					password: String(fakepass),
				})
			)
			.then(() => playground?.goTo(`/wp-admin/plugins.php`))
			.then(() =>
				rm(playground, {
					path: '/wordpress/wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php'
				})
			);
	}
}
