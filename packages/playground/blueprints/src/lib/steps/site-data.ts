import { PHPResponse } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

export type SetSiteOptionsArgs = {
	options: Record<string, unknown>;
};

export const setSiteOptions: StepHandler<SetSiteOptionsArgs> = async (
	client,
	options
) => {
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
};

export interface UpdateUserMetaArgs {
	meta: Record<string, unknown>;
	userId: number;
}
export const updateUserMeta: StepHandler<UpdateUserMetaArgs> = async (
	client,
	{ meta, userId }
) => {
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
};

async function assertSuccess(result: PHPResponse) {
	if (result.text !== 'Success') {
		console.log(result);
		throw new Error(`Failed to run code: ${result.text} ${result.errors}`);
	}
}
