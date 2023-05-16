import { phpVars, startPlaygroundWeb } from '@wp-playground/client';

import { remotePlaygroundOrigin } from './config';

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

	const js = phpVars({
		title: 'Test post',
		content: '<!-- wp:hello/log-block /-->',
	});

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
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'url',
						url: 'zips/hello.zip',
					},
				},
				{
					step: 'runPHP',
					code: `<?php
					require_once "/wordpress/wp-load.php";
					$post_id = wp_insert_post([
						"post_title" => ${js.title},
						"post_content" => ${js.content},
						"post_status" => "publish",
					]);
					file_put_contents('/post-id.txt', $post_id);
					`,
				},
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'url',
						url: '/plugin-proxy?repo=WordPress/block-interactivity-experiments&name=block-interactivity-experiments.zip',
					},
				},
			],
		},
	});

	const postId = await client.readFileAsText('/post-id.txt');
	await client.goTo(`/?p=${postId}`);

	document
		.getElementById('render.php')!
		.addEventListener('keyup', async (e) => {
			client.writeFile(
				'/wordpress/wp-content/plugins/hello/blocks/hello/render.php',
				(e.target as HTMLTextAreaElement).value
			);

			await client.goTo(`/?p=${postId}`);
		});

	document.getElementById('view.js')!.addEventListener('keyup', async (e) => {
		client.writeFile(
			'/wordpress/wp-content/plugins/hello/blocks/hello/view.js',
			(e.target as HTMLTextAreaElement).value
		);

		await client.goTo(`/?p=${postId}`);
	});
})();
