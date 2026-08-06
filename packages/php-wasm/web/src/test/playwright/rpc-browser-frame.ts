/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { exposeAPI } from '@php-wasm/universal';

const configuredOrigin = new URL(location.href).searchParams.get(
	'allowed-origin'
);

const [setReady] = exposeAPI(
	{
		ping(value: string) {
			return `frame:${value}`;
		},
		never() {
			return new Promise<never>(() => {});
		},
	},
	undefined,
	undefined,
	{ allowedOrigins: configuredOrigin || location.origin }
);

setReady();
