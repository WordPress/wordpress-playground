/**
 * Shared tool executor functions.
 *
 * Both the MCP server and WebMCP call these executors so that tool
 * output shapes are defined in exactly one place.  Each transport
 * provides its own ToolClient implementation that normalises I/O
 * differences (e.g. byte decoding).
 */

import type { PlaygroundClient } from '@wp-playground/remote';
import type { PHPRequest } from '@php-wasm/universal';

/**
 * Minimal client interface consumed by tool executors.
 *
 * - WebMCP implements this by wrapping PlaygroundClient (decoding
 *   response bytes via TextDecoder).
 * - The MCP server implements this by wrapping bridge.sendCommand
 *   (bytes are already decoded at the bridge-client boundary).
 */
export interface ToolClient {
	run(options: {
		code: string;
	}): Promise<{ text: string; errors: string; exitCode: number }>;
	request(options: {
		url: string;
		method: string;
		headers?: Record<string, string>;
		body?: string;
	}): Promise<{
		text: string;
		httpStatusCode: number;
		headers: Record<string, string[]>;
	}>;
	goTo(path: string): Promise<void>;
	getCurrentURL(): Promise<string>;
	readFileAsText(path: string): Promise<string>;
	writeFile(path: string, contents: string): Promise<void>;
	listFiles(path: string): Promise<string[]>;
	mkdirTree(path: string): Promise<void>;
	unlink(path: string): Promise<void>;
	rmdir(path: string, options: { recursive: boolean }): Promise<void>;
	fileExists(path: string): Promise<boolean>;
}

export interface SiteInfo {
	url: string;
	documentRoot: string;
	siteUrl: string;
	wpVersion: string;
	phpVersion: string;
}

async function executeSiteInfo(client: ToolClient): Promise<SiteInfo> {
	const [url, infoText] = await Promise.all([
		client.getCurrentURL(),
		client
			.run({
				code: `<?php
			require_once "/wordpress/wp-load.php";
			echo json_encode([
				"documentRoot" => ABSPATH,
				"wpVersion" => get_bloginfo("version"),
				"siteUrl" => get_site_url(),
				"phpVersion" => phpversion(),
			]);`,
			})
			.then((resp) => resp.text),
	]);

	let info: Partial<Omit<SiteInfo, 'url'>>;
	try {
		info = JSON.parse(infoText);
	} catch {
		info = {};
	}

	return {
		url: String(url),
		documentRoot: info.documentRoot ?? '/wordpress',
		siteUrl: info.siteUrl ?? String(url),
		wpVersion: info.wpVersion ?? 'unknown',
		phpVersion: info.phpVersion ?? 'unknown',
	};
}

export const toolExecutors: Record<
	string,
	(client: ToolClient, input: Record<string, unknown>) => Promise<unknown>
> = {
	playground_ability: (client, input) =>
		executeWordPressAbility(client, input),

	playground_execute_php: (client, input) =>
		client.run({ code: input['code'] as string }),

	playground_request: async (client, input) => {
		const url = input['url'] as string;
		const method = (input['method'] as string) ?? 'GET';
		const headers = {
			...((input['headers'] as Record<string, string>) ?? {}),
		};
		const body = input['body'] as string | undefined;

		try {
			const parsedUrl = new URL(url, 'http://localhost');
			const isRestApi =
				url.includes('/wp-json/') ||
				parsedUrl.searchParams.has('rest_route');

			// Auto-set Content-Type for REST API JSON bodies.
			if (
				isRestApi &&
				body &&
				!Object.keys(headers).some(
					(k) => k.toLowerCase() === 'content-type'
				)
			) {
				headers['Content-Type'] = 'application/json';
			}

			const hasNonce = Object.keys(headers).some(
				(k) => k.toLowerCase() === 'x-wp-nonce'
			);

			if (isRestApi && !hasNonce) {
				// Generate the nonce via a temporary PHP file requested
				// through request() — not run() — so that the cookie
				// store is included and WordPress ties the nonce to
				// the logged-in user.
				const nonceId = Math.random().toString(36).slice(2, 10);
				const noncePath = `/wordpress/wp-content/mcp-nonce-${nonceId}.php`;
				const nonceUrl = `/wp-content/mcp-nonce-${nonceId}.php`;
				const nonceCode =
					"<?php require_once '/wordpress/wp-load.php'; echo wp_create_nonce('wp_rest');";
				await client.writeFile(noncePath, nonceCode);
				let nonce = '';
				try {
					const nonceResp = await client.request({
						url: nonceUrl,
						method: 'GET',
					});
					nonce = nonceResp.text.trim();
				} finally {
					await client.unlink(noncePath);
				}
				if (nonce && nonce !== '0') {
					headers['X-WP-Nonce'] = nonce;
				}
			}
		} catch {
			// Nonce generation failed — proceed without it.
		}

		return await client.request({ url, method, headers, body });
	},

	playground_navigate: async (client, input) => {
		await client.goTo(input['path'] as string);
		return { url: await client.getCurrentURL() };
	},

	playground_get_current_url: async (client) => ({
		url: await client.getCurrentURL(),
	}),

	playground_get_site_info: (client): Promise<SiteInfo> =>
		executeSiteInfo(client),

	playground_read_file: async (client, input) => ({
		contents: await client.readFileAsText(input['path'] as string),
	}),

	playground_write_file: async (client, input) => {
		await client.writeFile(
			input['path'] as string,
			input['contents'] as string
		);
		return { success: true };
	},

	playground_list_files: async (client, input) => ({
		files: await client.listFiles(input['path'] as string),
	}),

	playground_mkdir: async (client, input) => {
		await client.mkdirTree(input['path'] as string);
		return { success: true };
	},

	playground_delete_file: async (client, input) => {
		await client.unlink(input['path'] as string);
		return { success: true };
	},

	playground_delete_directory: async (client, input) => {
		await client.rmdir(input['path'] as string, {
			recursive: (input['recursive'] as boolean) ?? false,
		});
		return { success: true };
	},

	playground_file_exists: async (client, input) => ({
		exists: await client.fileExists(input['path'] as string),
	}),
};

async function executeWordPressAbility(
	client: ToolClient,
	input: Record<string, unknown>
): Promise<unknown> {
	const marker = '---PLAYGROUND_MCP_ABILITY_RESULT---';
	const response = await client.run({
		code: createAbilityToolPHP(input, marker),
	});
	const markerIndex = response.text.lastIndexOf(marker);
	if (markerIndex === -1) {
		return {
			error: 'WordPress ability response marker not found',
			text: response.text,
			errors: response.errors,
			exitCode: response.exitCode,
		};
	}

	const jsonText = response.text.slice(markerIndex + marker.length).trim();
	try {
		const result = JSON.parse(jsonText);
		if (response.errors || response.exitCode !== 0) {
			return {
				...result,
				errors: response.errors,
				exitCode: response.exitCode,
			};
		}
		return result;
	} catch (error) {
		return {
			error: `Could not parse WordPress ability response: ${
				error instanceof Error ? error.message : String(error)
			}`,
			text: response.text,
			errors: response.errors,
			exitCode: response.exitCode,
		};
	}
}

function createAbilityToolPHP(
	input: Record<string, unknown>,
	marker: string
): string {
	const encodedInput = phpStringLiteral(JSON.stringify(input));
	const encodedMarker = phpStringLiteral(marker);

	return `<?php
require_once "/wordpress/wp-load.php";

$playground_mcp_input = json_decode('${encodedInput}', true);
$playground_mcp_marker = '${encodedMarker}';

function playground_mcp_ability_json($value) {
	$json = function_exists('wp_json_encode')
		? wp_json_encode($value, JSON_UNESCAPED_SLASHES)
		: json_encode($value, JSON_UNESCAPED_SLASHES);
	return is_string($json) ? $json : '{}';
}

function playground_mcp_ability_bool($value) {
	if (is_bool($value)) {
		return $value;
	}
	if (is_string($value)) {
		return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
	}
	return (bool) $value;
}

function playground_mcp_ability_is_list($value) {
	if (!is_array($value)) {
		return false;
	}
	$index = 0;
	foreach ($value as $key => $_) {
		if ($key !== $index) {
			return false;
		}
		$index++;
	}
	return true;
}

function playground_mcp_ability_annotations($ability) {
	$annotations = [];
	if (is_object($ability)) {
		$meta = [];
		if (method_exists($ability, 'get_meta')) {
			$meta = $ability->get_meta() ?: [];
		} elseif (isset($ability->meta) && is_array($ability->meta)) {
			$meta = $ability->meta;
		}
		if (is_array($meta) && isset($meta['annotations'])) {
			$annotations = $meta['annotations'];
		} elseif (isset($ability->annotations) && is_array($ability->annotations)) {
			$annotations = $ability->annotations;
		}
	} elseif (is_array($ability)) {
		$annotations = $ability['meta']['annotations'] ?? $ability['annotations'] ?? [];
	}
	if (!is_array($annotations)) {
		$annotations = [];
	}
	return [
		'readonly' => playground_mcp_ability_bool($annotations['readonly'] ?? false),
		'destructive' => playground_mcp_ability_bool($annotations['destructive'] ?? false),
		'instructions' => (string) ($annotations['instructions'] ?? ''),
	];
}

function playground_mcp_ability_id($id, $ability) {
	if (is_object($ability)) {
		if (method_exists($ability, 'get_name')) {
			return (string) $ability->get_name();
		}
		return (string) ($ability->name ?? $id);
	}
	return (string) $id;
}

function playground_mcp_ability_value($ability, $getter, $property, $fallback = '') {
	if (is_object($ability)) {
		if (method_exists($ability, $getter)) {
			return $ability->$getter();
		}
		return $ability->$property ?? $fallback;
	}
	if (is_array($ability)) {
		return $ability[$property] ?? $fallback;
	}
	return $fallback;
}

function playground_mcp_ability_list($category) {
	if (!function_exists('wp_get_abilities')) {
		return [
			'error' => 'Abilities API not available',
			'message' => 'WordPress with the Abilities API is required.',
			'abilities' => [],
			'count' => 0,
		];
	}

	$abilities = wp_get_abilities();
	if (!is_array($abilities)) {
		$abilities = [];
	}

	if ($category !== '') {
		$abilities = array_filter(
			$abilities,
			function ($ability, $id) use ($category) {
				$ability_id = playground_mcp_ability_id($id, $ability);
				$name = playground_mcp_ability_value($ability, 'get_label', 'label', $ability_id);
				$ability_category = playground_mcp_ability_value(
					$ability,
					'get_category',
					'category',
					''
				);
				return stripos((string) $ability_id, $category) !== false ||
					stripos((string) $name, $category) !== false ||
					(
						$ability_category !== '' &&
						(
							stripos((string) $ability_category, $category) !== false ||
							stripos($category, (string) $ability_category) !== false
						)
					);
			},
			ARRAY_FILTER_USE_BOTH
		);
	}

	$result = [];
	foreach ($abilities as $id => $ability) {
		$ability_id = playground_mcp_ability_id($id, $ability);
		$annotations = playground_mcp_ability_annotations($ability);
		$result[] = [
			'id' => $ability_id,
			'name' => playground_mcp_ability_value($ability, 'get_label', 'label', $ability_id),
			'description' => playground_mcp_ability_value(
				$ability,
				'get_description',
				'description',
				''
			),
			'category' => playground_mcp_ability_value(
				$ability,
				'get_category',
				'category',
				'uncategorized'
			),
			'readonly' => $annotations['readonly'],
			'destructive' => $annotations['destructive'],
		];
	}

	return [
		'abilities' => array_values($result),
		'count' => count($result),
		'filter' => $category === '' ? null : $category,
	];
}

function playground_mcp_ability_get($ability_id) {
	if (!function_exists('wp_get_ability')) {
		return [
			'error' => 'Abilities API not available',
			'message' => 'WordPress with the Abilities API is required.',
		];
	}

	$ability = wp_get_ability($ability_id);
	if ($ability === null) {
		throw new Exception("Ability not found: $ability_id");
	}

	$annotations = playground_mcp_ability_annotations($ability);
	return [
		'id' => playground_mcp_ability_id($ability_id, $ability),
		'name' => playground_mcp_ability_value($ability, 'get_label', 'label', $ability_id),
		'description' => playground_mcp_ability_value(
			$ability,
			'get_description',
			'description',
			''
		),
		'category' => playground_mcp_ability_value(
			$ability,
			'get_category',
			'category',
			'uncategorized'
		),
		'input_schema' => playground_mcp_ability_value(
			$ability,
			'get_input_schema',
			'input_schema',
			[]
		),
		'output_schema' => playground_mcp_ability_value(
			$ability,
			'get_output_schema',
			'output_schema',
			[]
		),
		'annotations' => [
			'readonly' => $annotations['readonly'],
			'destructive' => $annotations['destructive'],
		],
		'instructions' => $annotations['instructions'],
	];
}

function playground_mcp_ability_result($ability_id, $result) {
	$response = [
		'ability' => $ability_id,
		'success' => true,
	];

	if (is_object($result)) {
		if ($result instanceof JsonSerializable) {
			$result = $result->jsonSerialize();
		} else {
			$result = get_object_vars($result);
		}
	}

	if (!is_array($result) || playground_mcp_ability_is_list($result)) {
		$response['result'] = $result;
		return $response;
	}

	foreach ($result as $key => $value) {
		$key = (string) $key;
		if ($key === '' || array_key_exists($key, $response)) {
			continue;
		}
		$response[$key] = $value;
	}
	return $response;
}

function playground_mcp_ability_execute($ability_id, $arguments) {
	if (!function_exists('wp_get_ability')) {
		return [
			'error' => 'Abilities API not available',
			'message' => 'WordPress with the Abilities API is required.',
		];
	}
	if (!is_array($arguments)) {
		throw new Exception('Ability arguments must be an object.');
	}

	$ability = wp_get_ability($ability_id);
	if ($ability === null) {
		throw new Exception("Ability not found: $ability_id");
	}
	if (!is_object($ability) || !method_exists($ability, 'execute')) {
		throw new Exception("Ability is not executable: $ability_id");
	}

	$result = $ability->execute($arguments);
	if (is_wp_error($result)) {
		throw new Exception('Ability execution failed: ' . $result->get_error_message());
	}

	$response = playground_mcp_ability_result($ability_id, $result);
	$instructions = apply_filters(
		'ai_assistant_ability_instructions',
		'',
		$ability_id,
		$arguments,
		$result
	);
	$instructions = apply_filters(
		'playground_mcp_ability_instructions',
		$instructions,
		$ability_id,
		$arguments,
		$result
	);
	if ($instructions) {
		$response['_instructions'] = (string) $instructions;
	}
	return $response;
}

try {
	if (!is_array($playground_mcp_input)) {
		throw new Exception('Tool input must be an object.');
	}
	$action = (string) ($playground_mcp_input['action'] ?? 'list');
	$category = (string) ($playground_mcp_input['category'] ?? '');
	$ability_id = (string) ($playground_mcp_input['ability'] ?? '');
	$arguments = $playground_mcp_input['arguments'] ?? [];

	switch ($action) {
		case 'list':
			$result = playground_mcp_ability_list($category);
			break;
		case 'get':
			if ($ability_id === '') {
				throw new Exception('action="get" requires an ability identifier.');
			}
			$result = playground_mcp_ability_get($ability_id);
			break;
		case 'execute':
			if ($ability_id === '') {
				throw new Exception('action="execute" requires an ability identifier.');
			}
			$result = playground_mcp_ability_execute($ability_id, $arguments);
			break;
		default:
			throw new Exception("Unknown ability action: $action");
	}
} catch (Throwable $error) {
	$result = [
		'error' => $error->getMessage(),
	];
}

echo $playground_mcp_marker . playground_mcp_ability_json($result);
`;
}

function phpStringLiteral(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Wrap a PlaygroundClient as a ToolClient.
 *
 * Most methods pass through directly. Only `run` and `request`
 * are intercepted to decode PHP/HTTP response bytes into plain
 * strings via TextDecoder.
 */
export function createToolClient(client: PlaygroundClient): ToolClient {
	const decoder = new TextDecoder();
	const overrides: Partial<ToolClient> = {
		async run(options) {
			const resp = await client.run(options);
			return {
				text: decoder.decode(resp.bytes),
				errors: resp.errors,
				exitCode: resp.exitCode,
			};
		},
		async request(options) {
			const resp = await client.request({
				url: options.url,
				method: options.method as PHPRequest['method'],
				headers: options.headers,
				body: options.body,
			});
			return {
				text: decoder.decode(resp.bytes),
				httpStatusCode: resp.httpStatusCode,
				headers: resp.headers,
			};
		},
	};
	return new Proxy(client as unknown as ToolClient, {
		get: (target, prop: string) => {
			const override = (overrides as Record<string, unknown>)[prop];
			if (override !== undefined) {
				return override;
			}
			const val = (target as unknown as Record<string, unknown>)[prop];
			return typeof val === 'function' ? val.bind(target) : val;
		},
	});
}
