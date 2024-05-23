import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { resetData } from './reset-data';
import { PHPRequestHandler } from '@php-wasm/universal';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { unzip } from './unzip';

const docroot = '/php';
describe('Blueprint step resetData()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		const handler = new PHPRequestHandler({
			phpFactory: () => NodePHP.load(RecommendedPHPVersion),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();
		php.mkdir(docroot);
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should assign ID=1 to the first post created after applying the resetData step', async () => {
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		await resetData(php, {});
		const result = await php.run({
			code: `<?php 
			require "/wordpress/wp-load.php";
			// Create a new WordPress post
			$postId = wp_insert_post([
				'post_title' => 'My New Post',
				'post_content' => 'This is the content of my new post.',
				'post_status' => 'publish',
			]);

			if (!$postId || is_wp_error($postId)) {
				throw new Error('Error creating post.');
			}

			echo json_encode($postId);
			`,
		});

		expect(result.text).toBe('1');
	});
});
