import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import {
	createServer as createHttpsServer,
	type Server as HttpsServer,
} from 'node:https';
import type { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { expect, test, type Page, type Route } from '@playwright/test';
import { joinPaths } from '@php-wasm/util';
import {
	getAvailablePort,
	listenOnAvailablePort,
	readRequestBody,
	startPhpServer,
	stopHttpServer,
	stopPhpServer,
	waitForPhpServer,
	type PhpServer,
} from '../php-server';

declare global {
	interface Window {
		__oauthPopupMessages?: unknown[];
	}
}

/**
 * Stable contract: oauth.php sends the GitHub client secret and authorization
 * code only over TLS verified for github.com. When verification fails, the
 * popup sends the app an error instead of a token.
 *
 * Plausible regression: certificate or hostname verification is turned off
 * again, for example to work around a missing local CA bundle.
 *
 * Independent code path: the real oauth.php runs under `php -S`, and the app
 * loads its redirect and popup pages at the app's own oauth.php URL. Its cURL
 * request reaches "github.com" through a local proxy that presents throwaway
 * certificates and records what it receives.
 */

test.describe.configure({ mode: 'serial' });
test.skip(
	({ browserName }) => browserName !== 'chromium',
	'The token exchange runs server-side, so one Playwright project is enough.'
);

const oauthHandler = joinPaths(__dirname, '../../public/oauth.php');
const CLIENT_SECRET = 'test-client-secret';
const AUTHORIZATION_CODE = 'test-authorization-code';
const OAUTH_MESSAGE_TYPE = 'playground-github-oauth-token';

const sockets = new Set<Socket>();
let connects: string[] = [];
let received: string[] = [];
let temporary = '';
let githubInterceptor: HttpsServer;
let otherHostInterceptor: HttpsServer;
let activeInterceptor: HttpsServer;
let proxyServer: Server | undefined;
// One handler trusts the test CA; the other keeps PHP's normal CA bundle.
let trustingHandler: PhpServer | undefined;
let defaultHandler: PhpServer | undefined;
let trustingHandlerUrl = '';
let defaultHandlerUrl = '';

test.beforeAll(async () => {
	temporary = await mkdtemp(joinPaths(tmpdir(), 'playground-oauth-tls-'));
	const ca = await createCertificateAuthority();
	githubInterceptor = createInterceptor(
		await createCertificate(ca, 'github.com', 2)
	);
	otherHostInterceptor = createInterceptor(
		await createCertificate(ca, 'other.example', 3)
	);
	activeInterceptor = githubInterceptor;

	proxyServer = createServer();
	proxyServer.on('connect', (request, socket: Socket, head) => {
		sockets.add(socket);
		connects.push(request.url ?? '');
		socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
		socket.unshift(head);
		activeInterceptor.emit('connection', socket);
	});
	const proxyUrl = `http://127.0.0.1:${await listenOnAvailablePort(proxyServer)}`;

	// The callback URL must use the app origin so the popup can reach its opener.
	const appOrigin = new URL(test.info().project.use.baseURL!).origin;
	[trustingHandler, trustingHandlerUrl] = await startOAuthHandler({
		proxyUrl,
		appOrigin,
		trustedCa: ca.certificatePath,
	});
	[defaultHandler, defaultHandlerUrl] = await startOAuthHandler({
		proxyUrl,
		appOrigin,
	});
});

test.beforeEach(() => {
	connects = [];
	received = [];
});

test.afterAll(async () => {
	for (const socket of sockets) {
		socket.destroy();
	}
	await Promise.all([
		stopPhpServer(trustingHandler),
		stopPhpServer(defaultHandler),
		stopHttpServer(proxyServer),
	]);
	if (temporary) {
		await rm(temporary, { recursive: true, force: true });
	}
});

test('connects with the token from a verified exchange', async ({ page }) => {
	activeInterceptor = githubInterceptor;
	const dialog = await connectToGitHub(page, trustingHandlerUrl);

	// This control shows the proxy can capture an exchange the handler trusts.
	await expect(dialog).not.toBeVisible();
	expect(await readPopupMessages(page)).toEqual([
		expect.objectContaining({
			type: OAUTH_MESSAGE_TYPE,
			token: 'intercepted-token',
		}),
	]);
	expect(connects).toEqual(['github.com:443']);
	expect(received).toHaveLength(1);
	expect(received[0]).toContain(CLIENT_SECRET);
	expect(received[0]).toContain(AUTHORIZATION_CODE);
});

test('sends an error without credentials to an untrusted certificate', async ({
	page,
}) => {
	activeInterceptor = githubInterceptor;
	const dialog = await connectToGitHub(page, defaultHandlerUrl);

	await expect
		.poll(async () => (await readPopupMessages(page))?.length)
		.toBeGreaterThan(0);
	expect(await readPopupMessages(page)).toEqual([
		{
			type: OAUTH_MESSAGE_TYPE,
			state: expect.any(String),
			error: expect.any(String),
		},
	]);
	await expect(
		dialog.getByRole('link', { name: 'Connect your GitHub account' })
	).toBeVisible();
	expect(connects).toEqual(['github.com:443']);
	expect(received).toEqual([]);
});

test('rejects a certificate for another host before sending credentials', async ({
	request,
}) => {
	activeInterceptor = otherHostInterceptor;
	const response = await request.get(
		`${trustingHandlerUrl}/oauth.php?code=${AUTHORIZATION_CODE}`
	);

	const body = await response.json();
	expect(body.access_token).toBeUndefined();
	expect(typeof body.error).toBe('string');
	expect(connects).toEqual(['github.com:443']);
	expect(received).toEqual([]);
});

/**
 * Starts the OAuth flow from the app, serving oauth.php from the given handler.
 * GitHub's authorize step returns straight to the callback, and any other
 * github.com request is aborted so the test never reaches GitHub.
 */
async function connectToGitHub(page: Page, handlerUrl: string) {
	await page.context().route(
		(url) => url.pathname.endsWith('/oauth.php'),
		(route) => forwardToOAuthHandler(route, handlerUrl)
	);
	await page
		.context()
		.route((url) => url.hostname === 'github.com', redirectToCallback);

	await page.goto('./?gh-ensure-auth=yes');
	const dialog = page.getByRole('dialog', { name: 'Connect to GitHub' });
	await expect(dialog).toBeVisible();
	await page.evaluate(() => {
		window.__oauthPopupMessages = [];
		window.addEventListener('message', (event) => {
			if (event.source !== window) {
				window.__oauthPopupMessages!.push(event.data);
			}
		});
	});
	await page
		.getByRole('link', { name: 'Connect your GitHub account' })
		.click();
	return dialog;
}

/** Returns the messages other windows posted to the app, such as the popup. */
function readPopupMessages(page: Page) {
	return page.evaluate(() => window.__oauthPopupMessages);
}

async function redirectToCallback(route: Route) {
	const authorizeUrl = new URL(route.request().url());
	if (authorizeUrl.pathname !== '/login/oauth/authorize') {
		await route.abort();
		return;
	}
	const callbackUrl = new URL(authorizeUrl.searchParams.get('redirect_uri')!);
	callbackUrl.searchParams.set('code', AUTHORIZATION_CODE);
	callbackUrl.searchParams.set(
		'state',
		authorizeUrl.searchParams.get('state')!
	);
	await fulfillWithNavigation(route, callbackUrl.toString());
}

async function forwardToOAuthHandler(route: Route, handlerUrl: string) {
	const requestUrl = new URL(route.request().url());
	const response = await route.fetch({
		url: `${handlerUrl}${requestUrl.pathname}${requestUrl.search}`,
		maxRedirects: 0,
	});
	const location = response.headers()['location'];
	if (location) {
		await fulfillWithNavigation(route, location);
		return;
	}
	await route.fulfill({ response });
}

/**
 * Playwright does not route requests that follow a fulfilled redirect, so
 * replace each redirect with a page that navigates to the same location.
 */
async function fulfillWithNavigation(route: Route, location: string) {
	await route.fulfill({
		contentType: 'text/html',
		body: `<script>location.replace(${JSON.stringify(location)});</script>`,
	});
}

async function startOAuthHandler({
	proxyUrl,
	appOrigin,
	trustedCa,
}: {
	proxyUrl: string;
	appOrigin: string;
	trustedCa?: string;
}): Promise<[PhpServer, string]> {
	const url = `http://127.0.0.1:${await getAvailablePort()}`;
	const server = startPhpServer(
		[
			'-d',
			'display_errors=0',
			// PHP's cURL reads openssl.cafile before curl.cainfo.
			...(trustedCa ? ['-d', `openssl.cafile=${trustedCa}`] : []),
			'-S',
			url.replace('http://', ''),
			oauthHandler,
		],
		{
			CLIENT_ID: 'test-client-id',
			CLIENT_SECRET,
			OAUTH_CALLBACK_BASE_URL: appOrigin,
			https_proxy: proxyUrl,
			HTTPS_PROXY: proxyUrl,
			http_proxy: '',
			HTTP_PROXY: '',
			all_proxy: '',
			ALL_PROXY: '',
			no_proxy: '',
			NO_PROXY: '',
		}
	);
	// The readiness request exchanges a code through the proxy, not GitHub.
	await waitForPhpServer(server, `${url}/oauth.php?code=readiness-check`);
	return [server, url];
}

/** Terminates intercepted TLS and records every token request it receives. */
function createInterceptor(certificate: { key: Buffer; cert: Buffer }) {
	return createHttpsServer(certificate, async (request, response) => {
		received.push(await readRequestBody(request));
		response.writeHead(200, {
			'Content-Type': 'application/x-www-form-urlencoded',
		});
		response.end('access_token=intercepted-token&token_type=bearer');
	});
}

async function createCertificateAuthority() {
	const keyPath = joinPaths(temporary, 'ca.key');
	const certificatePath = joinPaths(temporary, 'ca.pem');
	const extensionsPath = joinPaths(temporary, 'ca.ext');
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
		...['-out', joinPaths(temporary, 'ca.csr')]
	);
	openssl(
		...['x509', '-req', '-in', joinPaths(temporary, 'ca.csr')],
		...['-key', keyPath, '-days', '1', '-set_serial', '1'],
		...['-extfile', extensionsPath, '-out', certificatePath]
	);
	return { keyPath, certificatePath };
}

async function createCertificate(
	ca: { keyPath: string; certificatePath: string },
	hostname: string,
	serial: number
) {
	const keyPath = joinPaths(temporary, `${hostname}.key`);
	const certificatePath = joinPaths(temporary, `${hostname}.pem`);
	const extensionsPath = joinPaths(temporary, `${hostname}.ext`);
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
		...['-out', joinPaths(temporary, `${hostname}.csr`)]
	);
	openssl(
		...['x509', '-req', '-in', joinPaths(temporary, `${hostname}.csr`)],
		...['-CA', ca.certificatePath, '-CAkey', ca.keyPath],
		...['-days', '1', '-set_serial', String(serial)],
		...['-extfile', extensionsPath, '-out', certificatePath]
	);
	return {
		key: await readFile(keyPath),
		cert: await readFile(certificatePath),
	};
}

function openssl(...args: string[]) {
	execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
}
