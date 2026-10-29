import { test, expect } from '../playground-fixtures';
import { blueprint, fixture } from '../abilities-fixtures';
import Ajv from 'ajv';

// Discovery must emit valid JSON Schema without converting literal arrays or
// schema lists into objects. PHP's empty arrays make these independent cases.
test('ability discovery preserves empty schemas and array keywords', async ({
	website,
}) => {
	const schemaFixture = `<?php
add_action('wp_abilities_api_categories_init', function () {
 wp_register_ability_category('fixture', array('label' => 'Fixture', 'description' => 'Schema test'));
});
add_action('wp_abilities_api_init', function () {
 wp_register_ability('fixture/schema', array(
  'label' => 'Schema', 'description' => 'Preserves JSON Schema shapes', 'category' => 'fixture',
  'permission_callback' => '__return_true', 'execute_callback' => '__return_null',
  'input_schema' => array(
   'type' => 'object',
   'properties' => array(
    'payload' => array(),
    'list' => array('type' => 'array', 'items' => array(), 'enum' => array(array()), 'examples' => array(array()), 'default' => array()),
    'tuple' => array('type' => 'array', 'items' => array(array(), array('type' => 'string')))
   ),
   'additionalProperties' => array(),
   'definitions' => array('anything' => array()),
   'dependencies' => array('payload' => array(), 'list' => array('payload'), 'tuple' => array('properties' => array('payload' => array()))),
   'allOf' => array(array()), 'anyOf' => array(array()), 'oneOf' => array(array()),
   'required' => array(),
   'default' => array(), 'x-extension' => array()
  )
 ));
});`;
	await website.goto(`./?storage=temp#${blueprint('6.9', schemaFixture)}`);
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);
	const schema = await website.page.evaluate(async () => {
		const list = await (window as any).playground.listAbilities();
		return list.abilities.find(
			(ability: any) => ability.name === 'fixture/schema'
		).input_schema;
	});
	const validator = new Ajv({ strict: false });
	expect(
		validator.validateSchema(schema),
		JSON.stringify(validator.errors)
	).toBe(true);
	expect(schema.properties.payload).toEqual({});
	expect(schema.properties.list.items).toEqual({});
	expect(schema.properties.tuple.items).toEqual([{}, { type: 'string' }]);
	expect(schema.additionalProperties).toEqual({});
	expect(schema.definitions.anything).toEqual({});
	expect(schema.dependencies).toEqual({
		payload: [],
		list: ['payload'],
		tuple: { properties: { payload: {} } },
	});
	for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
		expect(schema[keyword]).toEqual([{}]);
	}
	expect(schema.required).toEqual([]);
	expect(schema.properties.list.enum).toEqual([[]]);
	expect(schema.properties.list.examples).toEqual([[]]);
	expect(schema.properties.list.default).toEqual([]);
	expect(schema.default).toEqual({});
	expect(schema['x-extension']).toEqual([]);
});

// Transport failures must retain the HTTP status and must not retry a callback
// that may already have changed the site before emitting a non-JSON response.
test('non-JSON ability responses report HTTP status without retrying', async ({
	website,
}) => {
	const errorFixture =
		fixture +
		`
add_action('wp_abilities_api_init', function () {
 foreach (array(200, 500) as $status) {
  wp_register_ability('fixture/response-' . $status, array(
   'label' => 'Invalid response', 'description' => 'Emits a non-JSON response', 'category' => 'fixture',
   'permission_callback' => '__return_true',
   'execute_callback' => function () use ($status) {
    update_option('fixture_response_executions', get_option('fixture_response_executions', 0) + 1);
    if ($status === 500) {
     wp_die('<p>Fixture failure</p>', '', array('response' => 500));
    }
    echo '<p>Unexpected plugin output</p>';
    return null;
   }
  ));
 }
});`;
	await website.goto(`./?storage=temp#${blueprint('6.9', errorFixture)}`);
	await website.page.waitForFunction(() =>
		Boolean((window as any).playground)
	);
	for (const status of [200, 500]) {
		await expect(
			website.page.evaluate(
				async (status) =>
					(window as any).playground.executeAbility(
						`fixture/response-${status}`
					),
				status
			)
		).rejects.toThrow(
			`WordPress returned an invalid response (HTTP ${status}). The operation may have completed.`
		);
	}
	const executions = await website.page.evaluate(async () => {
		const result = await (window as any).playground.run({
			code: '<?php require "/wordpress/wp-load.php"; echo get_option("fixture_response_executions");',
		});
		return result.text;
	});
	expect(executions).toBe('2');
});

test('abilities preserve inputs, permissions, and structured errors', async ({
	website,
}) => {
	const page = website.page;
	await website.goto(`./?storage=temp#${blueprint()}`);
	await page.waitForFunction(() => Boolean((window as any).playground));
	const results = await page.evaluate(async () => {
		const client = (window as any).playground;
		return {
			list: await client.listAbilities(),
			object: await client.executeAbility('fixture/object', {
				message: 'hello',
			}),
			scalar: await client.executeAbility('fixture/scalar', 'scalar'),
			noInput: await client.executeAbility('fixture/no-input'),
			denied: await client.executeAbility('fixture/denied'),
			error: await client.executeAbility('fixture/error'),
			invalid: await client.executeAbility('fixture/object', {
				message: 7,
			}),
		};
	});
	expect(results.list.available).toBe(true);
	expect(
		results.list.abilities.find(
			(ability: any) => ability.name === 'fixture/object'
		).meta.show_in_rest
	).not.toBe(true);
	expect(results.object).toEqual({
		success: true,
		data: { message: 'hello', user: results.list.user.id },
	});
	expect(results.scalar).toEqual({ success: true, data: 'scalar' });
	expect(results.noInput).toEqual({ success: true, data: false });
	expect(results.denied.success).toBe(false);
	expect(results.invalid.success).toBe(false);
	expect(results.error.errors).toContainEqual({
		code: 'fixture_error',
		message: 'Fixture failure',
		data: { reason: 42 },
	});
	await page.evaluate(async (userId) => {
		await (window as any).playground.run({
			code:
				'<?php require "/wordpress/wp-load.php"; WP_Session_Tokens::get_instance(' +
				userId +
				')->destroy_all();',
		});
	}, results.list.user.id);
	await expect(
		page.evaluate(async () => (window as any).playground.listAbilities())
	).rejects.toThrow('Sign in to WordPress');
});
