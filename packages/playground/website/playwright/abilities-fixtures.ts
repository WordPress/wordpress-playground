export const fixture = `<?php
add_action('wp_abilities_api_categories_init', function () {
 wp_register_ability_category('fixture', array('label' => 'Fixture', 'description' => 'Developer test abilities'));
});
add_action('wp_abilities_api_init', function () {
 $base = array('label' => 'Echo object', 'description' => 'Returns input with the current WordPress user.', 'category' => 'fixture', 'permission_callback' => '__return_true');
 wp_register_ability('fixture/object', array_merge($base, array(
  'input_schema' => array('type' => 'object', 'properties' => array('message' => array('type' => 'string')), 'required' => array('message')),
  'execute_callback' => function ($input) { return array('message' => $input['message'], 'user' => get_current_user_id()); }
 )));
 wp_register_ability('fixture/scalar', array_merge($base, array('label' => 'Echo scalar', 'input_schema' => array('type' => 'string'), 'execute_callback' => function ($input) { return $input; })));
 wp_register_ability('fixture/no-input', array_merge($base, array('label' => 'No input', 'execute_callback' => function () { return false; })));
 wp_register_ability('fixture/denied', array_merge($base, array('label' => 'Denied', 'permission_callback' => '__return_false', 'execute_callback' => function () { return 'MUST NOT RUN'; })));
 wp_register_ability('fixture/error', array_merge($base, array('label' => 'Error', 'execute_callback' => function () { return new WP_Error('fixture_error', 'Fixture failure', array('reason' => 42)); })));
});`;

export function blueprint(wp = '6.9', abilities = fixture) {
	return Buffer.from(
		JSON.stringify({
			preferredVersions: { php: '8.3', wp },
			landingPage: '/wp-admin/',
			steps: [
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/mu-plugins/abilities-fixture.php',
					data: abilities,
				},
				{ step: 'login' },
			],
		})
	).toString('base64');
}
