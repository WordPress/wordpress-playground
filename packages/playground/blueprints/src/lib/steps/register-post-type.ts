import { joinPaths, phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

/**
 * @inheritDoc registerPostType
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "registerPostType",
 *  	"name": "movie",
 * 		"args": {
 * 			"label": "Movies",
 *  	}
 * }
 * </code>
 */
export interface RegisterPostTypeStep {
	step: 'registerPostType';
	name: string;
	args: Record<string, any>;
}

/**
 * Moves a file or directory from one path to another.
 */
export const registerPostType: StepHandler<RegisterPostTypeStep> = async (
	playground,
	{ name, args }
) => {
	args = {
		// description: '',
		public: true,
		// publicly_queryable: true,
		show_ui: true,
		// show_in_rest: true,
		// rest_base: '',
		// rest_controller_class: 'WP_REST_Posts_Controller',
		// rest_namespace: 'wp/v2',
		// has_archive: true,
		show_in_menu: true,
		show_in_nav_menus: true,
		// delete_with_user: false,
		// exclude_from_search: false,
		// capability_type: 'post',
		// map_meta_cap: true,
		// hierarchical: false,
		// can_export: true,
		// rewrite: {
		// 	slug: 'actors',
		// 	with_front: true,
		// },
		// query_var: true,
		show_in_graphql: false,
		...args,
	};
	const phpCode = `<?php
        add_action( 'init', function() {
            $args = ${phpVar(args)};
            $args['label'] = esc_html__( $args['label'], 'textdomain' );
            foreach ($args['labels'] as $key => $value) {
                $args['labels'][$key] = esc_html__($value, 'textdomain');
            }
            register_post_type(${phpVar(name)}, $args);
        });
    ?>`;

	// Append this generated code snippet to register-post-types.php
	const muPluginPath = joinPaths(
		await playground.documentRoot,
		'wp-content/mu-plugins/register-post-types.php'
	);
	const currentCode = (await playground.fileExists(muPluginPath))
		? await playground.readFileAsText(muPluginPath)
		: '';
	await playground.writeFile(muPluginPath, currentCode + phpCode);
};
