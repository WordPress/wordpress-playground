import type { StepHandler } from '.';

/**
 * @inheritDoc resetData
 * @example
 *
 * <code>
 * {
 * 		"step": "resetData"
 * }
 * </code>
 */
export interface ResetDataStep {
	step: 'resetData';
	/**
	 * Content types to remove. When omitted, all posts, pages, custom post
	 * types, and comments are removed.
	 */
	contentTypes?: Array<'posts' | 'pages' | 'comments'>;
}

/**
 * Deletes the selected WordPress content through WordPress APIs so dependent
 * records are removed with it. Empty tables have their sequences reset so
 * later imports receive the identifiers they would on a site without the
 * removed content.
 *
 * @param playground Playground client.
 */
export const resetData: StepHandler<ResetDataStep> = async (
	playground,
	options,
	progress?
) => {
	progress?.tracker?.setCaption('Resetting WordPress data');
	const docroot = await playground.documentRoot;
	const contentTypes = new Set(options.contentTypes ?? []);
	const removeAllPostTypes = options.contentTypes === undefined;
	const postTypes = [
		contentTypes.has('posts') ? 'post' : undefined,
		contentTypes.has('pages') ? 'page' : undefined,
	].filter((postType): postType is string => postType !== undefined);
	const removePosts = removeAllPostTypes || contentTypes.has('posts');
	const removeComments = contentTypes.has('comments');

	await playground.run({
		env: {
			DOCROOT: docroot,
			PLAYGROUND_RESET_ALL_POST_TYPES: removeAllPostTypes ? '1' : '0',
			PLAYGROUND_RESET_POST_TYPES: JSON.stringify(postTypes),
			PLAYGROUND_RESET_POSTS: removePosts ? '1' : '0',
			PLAYGROUND_RESET_COMMENTS:
				removeAllPostTypes || removeComments ? '1' : '0',
		},
		code: `<?php
		require getenv('DOCROOT') . '/wp-load.php';

		$remove_all_post_types = getenv('PLAYGROUND_RESET_ALL_POST_TYPES') === '1';
		$post_types = json_decode(getenv('PLAYGROUND_RESET_POST_TYPES'), true);
		if (!is_array($post_types)) {
			throw new RuntimeException('Invalid post types passed to resetData.');
		}

		if ($remove_all_post_types) {
			$post_ids = $wpdb->get_col(
				"SELECT ID FROM {$wpdb->posts} ORDER BY ID DESC"
			);
		} elseif (count($post_types) > 0) {
			$placeholders = implode(', ', array_fill(0, count($post_types), '%s'));
			$post_ids = $wpdb->get_col($wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} " .
				"WHERE post_type IN ($placeholders) ORDER BY ID DESC",
				...$post_types
			));
		} else {
			$post_ids = [];
		}

		foreach ($post_ids as $post_id) {
			wp_delete_post((int) $post_id, true);
		}

		// WordPress refreshes this cache before deleting the post row, so removing
		// the last published post leaves the cache set to true.
		if (getenv('PLAYGROUND_RESET_POSTS') === '1') {
			delete_option('wp_calendar_block_has_published_posts');
		}

		$remove_comments = getenv('PLAYGROUND_RESET_COMMENTS') === '1';
		if ($remove_comments) {
			$comment_ids = $wpdb->get_col(
				"SELECT comment_ID FROM {$wpdb->comments}"
			);
			foreach ($comment_ids as $comment_id) {
				wp_delete_comment((int) $comment_id, true);
			}
		}

		$reset_sequence_if_empty = static function($table_name) use ($wpdb) {
			$count = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");
			if ((int) $count !== 0) {
				return;
			}
			if (isset($GLOBALS['@pdo'])) {
				$statement = $GLOBALS['@pdo']->prepare(
					'DELETE FROM SQLITE_SEQUENCE WHERE NAME = :table_name'
				);
				$statement->execute([':table_name' => $table_name]);
				return;
			}
			$wpdb->query("ALTER TABLE {$table_name} AUTO_INCREMENT = 1");
		};

		if ($remove_all_post_types || count($post_types) > 0) {
			$reset_sequence_if_empty($wpdb->posts);
			$reset_sequence_if_empty($wpdb->postmeta);
		}
		if ($remove_comments || $remove_all_post_types || count($post_types) > 0) {
			$reset_sequence_if_empty($wpdb->comments);
			$reset_sequence_if_empty($wpdb->commentmeta);
		}
		`,
	});
};
