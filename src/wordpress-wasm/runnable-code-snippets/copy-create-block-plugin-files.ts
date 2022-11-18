import { writeFiles } from './fs-utils';

export default async function copyCreateBlockPluginFiles(workerThread, toPath) {
	await workerThread.mkdirTree(toPath);
	await writeFiles(workerThread, toPath, [
		{ fileName: 'index.php', contents: INDEX_PHP },
		{ fileName: 'block.json', contents: BLOCK_JSON },
		{ fileName: 'edit.js', contents: EDIT_JS },
		{ fileName: 'save.js', contents: SAVE_JS },
		{ fileName: 'style.css', contents: STYLE_CSS },
		{ fileName: 'index.js', contents: INDEX_JS },
	]);
}

const INDEX_PHP = `<?php
/**
 * Plugin Name:       Example Static
 * Description:       Example block scaffolded with Create Block tool.
 * Requires at least: 5.9
 * Requires PHP:      7.0
 * Version:           0.1.0
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       example-static
 *
 * @package           create-block
 */


/**
 * Registers the block using the metadata loaded from the \`block.json\` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */
function create_block_example_static_block_init() {
	register_block_type( __DIR__ . '/block.json' );
}
add_action( 'init', 'create_block_example_static_block_init' );
`;

const INDEX_JS = `/**
* Registers a new block provided a unique name and an object defining its behavior.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
*/
import { registerBlockType } from '@wordpress/blocks';

/**
* Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
* All files containing \`style\` keyword are bundled together. The code used
* gets applied both to the front of your site and to the editor.
*
* @see https://www.npmjs.com/package/@wordpress/scripts#using-css
*/
import './style.css';

/**
* Internal dependencies
*/
import Edit from './edit';
import save from './save';
import metadata from './block.json';

if(!window.done) {
	window.done = true;
	/**
	* Every block starts by registering a new block type definition.
	*
	* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
	*/
	registerBlockType( metadata.name, {
		/**
		* @see ./edit.js
		*/
		edit: Edit,

		/**
		* @see ./save.js
		*/
		save,
	} );
}
`;

const STYLE_CSS = `/**
* The following styles get applied both on the front of your site
* and in the editor.
*
* Replace them with your own styles or remove the file completely.
*/

.wp-block-create-block-example-static {
	background-color: #21759b;
	color: #fff;
	padding: 2px;
}
`;

const SAVE_JS = `/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The save function defines the way in which the different attributes should
* be combined into the final markup, which is then serialized by the block
* editor into \`post_content\`.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#save
*
* @return {WPElement} Element to render.
*/
export default function save() {
	return (
		<p { ...useBlockProps.save() }>
			{ 'Example Static – hello from the saved contents!' }
		</p>
	);
}
`;

const EDIT_JS = `/**
* Retrieves the translation of text.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
*/
import { __ } from '@wordpress/i18n';

/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The edit function describes the structure of your block in the context of the
* editor. This represents what the editor will render when the block is used.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
*
* @return {WPElement} Element to render.
*/
export default function Edit() {
	return (
		<p { ...useBlockProps() }>
			{ __(
				'Example Static – hello from the editor!',
				'example-static'
			) }
		</p>
	);
}
`;

const BLOCK_JSON =
	JSON.stringify(
		{
			$schema: 'https://schemas.wp.org/trunk/block.json',
			apiVersion: 2,
			name: 'create-block/example-static',
			version: '0.1.0',
			title: 'Example Static',
			category: 'widgets',
			icon: 'smiley',
			description: 'Example block scaffolded with Create Block tool.',
			supports: {
				html: false,
			},
			textdomain: 'example-static',
			editorScript: 'file:./index.js',
			style: 'file:./style.css',
		},
		null,
		2
	) + '\n';
