import { StepHandler } from '.';
import { asDOM } from './common';

export type CreatePostStep = {
	step: 'createPost';
	/**
	 * The post data.
	 */
	data: {
		title: string;
		content: string;
		status?: 'publish' | 'draft' | 'pending' | 'private' | 'future';
		author?: number;
		excerpt?: string;
		date?: string;
		date_gmt?: string;
		slug?: string;
		password?: string;
		meta?: Record<string, string>;
		categories?: number[];
		tags?: number[];
		featured_media?: number;
	};
	/**
	 * Whether to redirect to the post after creating it.
	 */
	redirect?: boolean;
};

/**
 * Creates a new post.
 *
 * @param playground - The playground client.
 * @param {CreatePostStep} step - The step object containing post data.
 */
export const createPost: StepHandler<CreatePostStep> = async (
	playground,
	{
		data: { title, content = '', status = 'publish', ...rest },
		redirect = false,
	},
	progress
) => {
	progress?.tracker.setCaption(
		progress?.initialCaption || `Creating the "${title}" post`
	);

	try {
		// Check if the post title is not empty
		if (!title || title === '') {
			throw new Error('The post title cannot be empty');
		}

		const newPostResponse = await playground.request({
			url: '/wp-admin/post-new.php',
		});
		const newPostPage = asDOM(newPostResponse);
		const el = newPostPage.querySelector('#wp-api-request-js-extra');

		if (!el || !el.textContent) {
			throw new Error('Could not find nonce for creating a post');
		}

		const nonce = el.textContent.match(/"nonce":"([a-z0-9]*)"/)![1]!;

		const response = await playground.request({
			method: 'POST',
			url: '/index.php?rest_route=/wp/v2/posts',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce, // Use the nonce provided by WordPress
			},
			body: JSON.stringify({ title, content, status, ...rest }),
		});

		const data = response.json;

		if (redirect) {
			await (playground as any).goTo(`/?p=${data.id}/`);
		}

		if (response.httpStatusCode >= 400) {
			throw new Error(data.message);
		}
	} catch (e) {
		console.error(e);
	}
};
