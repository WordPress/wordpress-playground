/**
 * Check that oauth.php only exchanges GitHub codes over verified TLS.
 *
 * libcurl reaches "github.com" through a local CONNECT proxy that terminates TLS
 * with throwaway certificates. A certificate the handler trusts for github.com
 * proves the interception works. Untrusted and wrong-host certificates must fail
 * before the client secret or code is sent. No build, DNS, or GitHub access is used.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const handler = fileURLToPath(
	new URL('../website/public/oauth.php', import.meta.url)
);
const temporary = await mkdtemp(join(tmpdir(), 'playground-oauth-tls-'));
const sockets = new Set();
const connects = [];
const received = [];
let interceptor;
let proxy;
try {
	const ca = await createCertificateAuthority();
	const githubCertificate = await createCertificate(ca, 'github.com', 2);
	const otherHostCertificate = await createCertificate(
		ca,
		'other.example',
		3
	);

	proxy = createHttpServer();
	proxy.on('connect', (request, socket, head) => {
		sockets.add(socket);
		connects.push(request.url);
		socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
		socket.unshift(head);
		interceptor.emit('connection', socket);
	});
	proxy.listen(0, '127.0.0.1');
	await once(proxy, 'listening');
	const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;

	const untrusted = await exchangeCode({
		proxyUrl,
		certificate: githubCertificate,
	});
	assertRejected(untrusted, 'untrusted certificate');

	const otherHost = await exchangeCode({
		proxyUrl,
		certificate: otherHostCertificate,
		trustedCa: ca.certificatePath,
	});
	assertRejected(otherHost, 'wrong-host certificate');

	// Without this control, a broken proxy setup would also look like a rejection.
	const trusted = await exchangeCode({
		proxyUrl,
		certificate: githubCertificate,
		trustedCa: ca.certificatePath,
	});
	assert.deepEqual(trusted.connects, ['github.com:443']);
	assert.equal(trusted.received.length, 1);
	assert.match(trusted.received[0], /test-client-secret/);
	assert.match(trusted.received[0], /test-authorization-code/);
	assert.equal(trusted.body.access_token, 'intercepted-token');
	console.log(
		'OAuth TLS: untrusted and wrong-host certificates were rejected before sending credentials.'
	);
} finally {
	for (const socket of sockets) {
		socket.destroy();
	}
	if (proxy) {
		proxy.close();
	}
	await rm(temporary, { recursive: true, force: true });
}

/**
 * Runs one token exchange through the proxy, presenting the given certificate.
 * `trustedCa` replaces PHP's cURL CA bundle when set. PHP reads openssl.cafile first.
 */
async function exchangeCode({ proxyUrl, certificate, trustedCa }) {
	connects.length = 0;
	received.length = 0;
	interceptor = createHttpsServer(certificate, (request, response) => {
		const chunks = [];
		request.on('data', (chunk) => chunks.push(chunk));
		request.on('end', () => {
			received.push(Buffer.concat(chunks).toString());
			response.writeHead(200, {
				'Content-Type': 'application/x-www-form-urlencoded',
			});
			response.end('access_token=intercepted-token&token_type=bearer');
		});
	});

	const port = await reservePort();
	const proxyEnv = { https_proxy: proxyUrl, HTTPS_PROXY: proxyUrl };
	const server = spawn(
		'php',
		[
			...(trustedCa ? ['-d', `openssl.cafile=${trustedCa}`] : []),
			'-S',
			`127.0.0.1:${port}`,
			handler,
		],
		{
			env: {
				...process.env,
				...proxyEnv,
				no_proxy: '',
				NO_PROXY: '',
				CLIENT_ID: 'test-client-id',
				CLIENT_SECRET: 'test-client-secret',
			},
		}
	);
	try {
		await once(server.stderr, 'data');
		const response = await fetch(
			`http://127.0.0.1:${port}/oauth.php?code=test-authorization-code`
		);
		return {
			connects: [...connects],
			received: [...received],
			body: await response.json(),
		};
	} finally {
		server.kill();
		await once(server, 'exit');
	}
}

/** Asserts the handler reached the proxy but sent nothing over the connection. */
function assertRejected(result, label) {
	assert.deepEqual(result.connects, ['github.com:443'], label);
	assert.deepEqual(result.received, [], label);
	assert.equal(result.body.access_token, undefined, label);
	assert.equal(typeof result.body.error, 'string', label);
}

async function reservePort() {
	const reservation = createServer();
	reservation.listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const { port } = reservation.address();
	await new Promise((resolve) => reservation.close(resolve));
	return port;
}

async function createCertificateAuthority() {
	const keyPath = join(temporary, 'ca.key');
	const certificatePath = join(temporary, 'ca.pem');
	const extensionsPath = join(temporary, 'ca.ext');
	// Current cURL builds apply strict X.509 checks, which require key identifiers.
	await writeFile(
		extensionsPath,
		[
			'basicConstraints=critical,CA:TRUE',
			'keyUsage=critical,keyCertSign',
			'subjectKeyIdentifier=hash',
			'',
		].join('\n')
	);
	openssl(
		...['req', '-new', '-newkey', 'rsa:2048', '-nodes'],
		...['-keyout', keyPath, '-subj', '/CN=Playground OAuth TLS test CA'],
		...['-out', join(temporary, 'ca.csr')]
	);
	openssl(
		...['x509', '-req', '-in', join(temporary, 'ca.csr'), '-key', keyPath],
		...['-days', '1', '-set_serial', '1', '-extfile', extensionsPath],
		...['-out', certificatePath]
	);
	return { keyPath, certificatePath };
}

async function createCertificate(ca, hostname, serial) {
	const keyPath = join(temporary, `${hostname}.key`);
	const certificatePath = join(temporary, `${hostname}.pem`);
	const extensionsPath = join(temporary, `${hostname}.ext`);
	await writeFile(
		extensionsPath,
		[
			`subjectAltName=DNS:${hostname}`,
			'extendedKeyUsage=serverAuth',
			'subjectKeyIdentifier=hash',
			'authorityKeyIdentifier=keyid',
			'',
		].join('\n')
	);
	openssl(
		...['req', '-new', '-newkey', 'rsa:2048', '-nodes'],
		...['-keyout', keyPath, '-subj', `/CN=${hostname}`],
		...['-out', join(temporary, `${hostname}.csr`)]
	);
	openssl(
		...['x509', '-req', '-in', join(temporary, `${hostname}.csr`)],
		...['-CA', ca.certificatePath, '-CAkey', ca.keyPath],
		...['-days', '1', '-set_serial', String(serial)],
		...['-extfile', extensionsPath, '-out', certificatePath]
	);
	return {
		key: await readFile(keyPath),
		cert: await readFile(certificatePath),
	};
}

function openssl(...args) {
	execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
}
