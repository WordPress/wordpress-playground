import { PHPResponse } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

export type SetSiteOptionsStep = {
	step: 'setSiteOptions';
	options: Record<string, unknown>;
};

export const setSiteOptions: StepHandler<SetSiteOptionsStep> = async (
	client,
	{ options }
) => {
	const code = `<?php
	include 'wordpress/wp-load.php';
	$site_options = ${phpVar(options)};
	foreach($site_options as $name => $value) {
		update_option($name, $value);
	}
	echo "Success";
	`;
	const result = await client.run({
		code,
	});
	assertSuccess(result);
	return { code, result };
};

export interface UpdateUserMetaStep {
	step: 'updateUserMeta';
	meta: Record<string, unknown>;
	userId: number;
}
export const updateUserMeta: StepHandler<UpdateUserMetaStep> = async (
	client,
	{ meta, userId }
) => {
	const code = `<?php
	include 'wordpress/wp-load.php';
	$meta = ${phpVar(meta)};
	foreach($meta as $name => $value) {
		update_user_meta(${phpVar(userId)}, $name, $value);
	}
	echo "Success";
	`;
	const result = await client.run({
		code,
	});
	assertSuccess(result);
	return { code, result };
};

async function assertSuccess(result: PHPResponse) {
	if (result.text !== 'Success') {
		console.log(result);
		throw new Error(`Failed to run code: ${result.text} ${result.errors}`);
	}
}
