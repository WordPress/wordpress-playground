import { PHPResponse } from '@php-wasm/web';
import { phpVar } from '@php-wasm/util';
import { PlaygroundClient } from '..';

export type SiteOptions = Record<string, unknown>;

export async function setSiteOptions(
	client: PlaygroundClient,
	options: SiteOptions
) {
	const result = await client.run({
		code: `<?php
	include 'wordpress/wp-load.php';
	$site_options = ${phpVar(options)};
	foreach($site_options as $name => $value) {
		update_option($name, $value);
	}
	echo "Success";
	`,
	});
	assertSuccess(result);
}

export type UserMeta = Record<string, unknown>;
export async function updateUserMeta(
	client: PlaygroundClient,
	meta: UserMeta,
	userId: number
) {
	const result = await client.run({
		code: `<?php
	include 'wordpress/wp-load.php';
	$meta = ${phpVar(meta)};
	foreach($meta as $name => $value) {
		update_user_meta(${phpVar(userId)}, $name, $value);
	}
	echo "Success";
	`,
	});
	assertSuccess(result);
}

async function assertSuccess(result: PHPResponse) {
	if (result.text !== 'Success') {
		console.log(result);
		throw new Error(`Failed to run code: ${result.text} ${result.errors}`);
	}
}
