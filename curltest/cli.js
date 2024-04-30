#!/usr/bin/env node

// import { NodePHP } from '@php-wasm/node';
import { NodePHP } from '../dist/packages/php-wasm/node/index.cjs';
import { rootCertificates } from 'tls';

const caBundlePath = new URL('ca-bundle.crt', (import.meta || {}).url).pathname;

NodePHP.load('8.0')
	.then((php) => {
		php.setPhpIniEntry('allow_url_fopen', '1');
		php.setPhpIniEntry('disable_functions', '');
		php.setPhpIniEntry('openssl.cafile', caBundlePath);
		php.useHostFilesystem();
		php.writeFile(caBundlePath, rootCertificates.join('\n'));

		console.log('php.run');
		return php.run({
			code: `<?php
		    echo file_get_contents('https://wordpress.org');
		    `,
		});
		return php.cli(['php', ...process.argv.slice(2)]);
	})
	.then((result) => {
		console.log('done!');
		console.log(result.text);
	})
	.catch((e) => {
		console.error(e);
	});

/*
  'php.wasm.__wrap_select',
  'php.wasm.Curl_socket_check',
  'php.wasm.Curl_is_connected',
  'php.wasm.multi_runsingle',
  'php.wasm.curl_multi_perform',
  'php.wasm.easy_transfer',
  'php.wasm.Curl_poll',
  'php.wasm.Curl_multi_wait',
  'php.wasm.curl_multi_poll',
  'php.wasm.easy_perform',
  'php.wasm.RAND_poll',
  'php.wasm.rand_status',
  'php.wasm.RAND_status',
  'php.wasm.rand_enough',
  'php.wasm.Curl_ossl_seed',
  'php.wasm.zif_curl_multi_exec'
  "php.wasm.ossl_connect_common",
  "php.wasm.Curl_ossl_connect_nonblocking",
  "php.wasm.Curl_ssl_connect_nonblocking",
  "php.wasm.https_connecting",
  "php.wasm.Curl_readwrite",
*/
