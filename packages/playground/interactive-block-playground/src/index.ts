import {
	installPlugin,
	PHPResponse,
	PlaygroundClient,
	startPlaygroundWeb,
} from '@wp-playground/client';

import { remotePlaygroundOrigin } from './config';

function asDOM(response: PHPResponse) {
	return new DOMParser().parseFromString(response.text, 'text/html')!;
}

async function createNewPost(
	client: PlaygroundClient,
	title: string,
	content: string,
	status = 'publish'
) {
	try {
		const newPostResponse = await client.request({
			url: '/wp-admin/post-new.php',
		});
		const newPostPage = asDOM(newPostResponse);
		const el = newPostPage.querySelector('#wp-api-request-js-extra');
		const nonce = el?.textContent?.match(/"nonce":"([a-z0-9]*)"/)![1]!;

		const response = await client.request({
			method: 'POST',
			url: '/index.php?rest_route=/wp/v2/posts',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce, // Use the nonce provided by WordPress
			},
			body: JSON.stringify({ title, content, status }),
		});

		const data = response.json;

		if (response.httpStatusCode >= 400) {
			throw new Error(data.message);
		} else {
			return data;
		}
	} catch (e) {
		console.error(e);
	}
}

// Set the text content of the render.php element
document.getElementById('render.php')!.textContent = `<?php
  $wrapper_attributes = get_block_wrapper_attributes();
?>

<div <?php echo $wrapper_attributes; ?>>
  <button
data-wp-on.click="actions.hello.log"
  >
HELLO
  </button>
</div>
`;

// Set the text content of the view.js
document.getElementById(
	'view.js'
)!.textContent = `// Disclaimer: Importing the "store" using a global is just a temporary solution.
const { store } = window.__experimentalInteractivity;

store({
  actions: {
    hello: {
      log: () => {
        console.log("hello!");
      },
    },
  },
});`;

(async () => {
	const playground = document.querySelector(
		'#playground'
	) as HTMLIFrameElement;

	const client = await startPlaygroundWeb({
		iframe: playground,
		remoteUrl: `${remotePlaygroundOrigin}/remote.html`,
		blueprint: {
			landingPage: '/wp-admin',
			preferredVersions: {
				php: '8.0',
				wp: 'latest',
			},
			steps: [
				{
					step: 'login',
					username: 'admin',
					password: 'password',
				},
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'wordpress.org/plugins',
						slug: 'gutenberg',
					},
				},
			],
		},
	});

	await client.isReady();

	const plugins = ['block-interactivity-experiments.zip', 'hello.zip'];
	for (const plugin of plugins) {
		const pluginResponse = await fetch(`zips/${plugin}`);
		const blob = await pluginResponse.blob();
		const pluginFile = new File([blob], plugin);
		await installPlugin(client, { pluginZipFile: pluginFile });
	}

	const data = await createNewPost(
		client,
		'Test post',
		'<!-- wp:hello/log-block /-->'
	);

	await client.goTo(`/?p=${data.id}`);

	document
		.getElementById('render.php')!
		.addEventListener('keyup', async (e) => {
			client.writeFile(
				'/wordpress/wp-content/plugins/hello/blocks/hello/render.php',
				e.target.value
			);

			await client.goTo(`/?p=${data.id}`);
		});

	document.getElementById('view.js')!.addEventListener('keyup', async (e) => {
		client.writeFile(
			'/wordpress/wp-content/plugins/hello/blocks/hello/view.js',
			e.target.value
		);

		await client.goTo(`/?p=${data.id}`);
	});
})();
