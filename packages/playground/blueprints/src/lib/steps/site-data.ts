import { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { BaseStep } from '.';

export type SiteOptions = Record<string, unknown>;

export interface SetSiteOptionsStep extends BaseStep {
	step: 'setSiteOptions';
	options: SiteOptions;
}

export interface UpdateUserMetaStep extends BaseStep {
	step: 'updateUserMeta';
	meta: UserMeta;
	userId: number;
}

export async function setSiteOptions(
	client: UniversalPHP,
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
	client: UniversalPHP,
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
