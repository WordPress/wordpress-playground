import { randomBytes } from 'crypto';
import {
	createServer,
	type AddressInfo,
	type Server as NetServer,
	type Socket,
} from 'net';
import { posix as posixPath } from 'path';
import { logger } from '@php-wasm/logger';
import type { RemoteAPI } from '@php-wasm/universal';
import type { PlaygroundCliBlueprintV1Worker } from './blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from './blueprints-v2/worker-thread-v2';

type PlaygroundCliWorker =
	| PlaygroundCliBlueprintV1Worker
	| PlaygroundCliBlueprintV2Worker;

const textDecoder = new TextDecoder();
const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

export interface PlaygroundFtpServer {
	address: { host: string; port: number };
	credentials: { username: string; password: string };
	close(): Promise<void>;
}

export interface StartFtpServerOptions {
	playground: RemoteAPI<PlaygroundCliWorker>;
	host?: string;
	port?: number;
	username?: string;
	password?: string;
}

interface FtpSessionOptions {
	socket: Socket;
	playground: RemoteAPI<PlaygroundCliWorker>;
	listenHost: string;
	advertiseHost: string;
	credentials: { username: string; password: string };
}

interface PendingDataSocket {
	resolve: (socket: Socket) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

interface FileMetadata {
	path: string;
	name: string;
	isDir: boolean;
	size: number;
	mtime: number;
	mode: number;
}

class FtpError extends Error {
	code: number;

	constructor(code: number, message: string) {
		super(message);
		this.code = code;
	}
}

function escapeForPhpSingleQuote(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatUnixPermissions(mode: number, isDir: boolean): string {
	const type = isDir ? 'd' : '-';
	const flags = [
		0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001,
	];
	const chars = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x'];
	let permissions = type;
	for (let i = 0; i < flags.length; i++) {
		permissions += mode & flags[i] ? chars[i] : '-';
	}
	return permissions;
}

function formatUnixDate(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	const month = MONTH_NAMES[date.getMonth()];
	const day = date.getDate().toString().padStart(2, ' ');
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	return `${month} ${day} ${hours}:${minutes}`;
}

function formatMdtm(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	const year = date.getFullYear().toString();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');
	return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function waitForSocketClose(socket: Socket): Promise<void> {
	return new Promise((resolve) => {
		if (socket.destroyed) {
			resolve();
			return;
		}
		socket.once('close', () => resolve());
	});
}

class FtpSession {
	private readonly socket: Socket;
	private readonly playground: RemoteAPI<PlaygroundCliWorker>;
	private readonly listenHost: string;
	private readonly advertiseHost: string;
	private readonly credentials: { username: string; password: string };

	private buffer = '';
	private cwd = '/';
	private loggedIn = false;
	private pendingUser: string | null = null;
	private passiveServer: NetServer | null = null;
	private passiveAddress: AddressInfo | null = null;
	private dataSocket: Socket | null = null;
	private pendingData: PendingDataSocket | null = null;
	private commandQueue: Promise<void> = Promise.resolve();
	private renameFrom: string | null = null;
	private closed = false;

	constructor(options: FtpSessionOptions) {
		this.socket = options.socket;
		this.playground = options.playground;
		this.listenHost = options.listenHost;
		this.advertiseHost = options.advertiseHost;
		this.credentials = options.credentials;

		this.socket.setEncoding('utf8');
		this.socket.on('data', (chunk) => this.onData(chunk));
		this.socket.on('close', () => {
			this.closed = true;
			void this.closePassiveServer();
		});

		this.reply(220, 'WordPress Playground FTP ready');
	}

	close() {
		if (this.closed) {
			return;
		}
		this.closed = true;
		void this.closePassiveServer();
		if (!this.socket.destroyed) {
			this.socket.end();
			this.socket.destroy();
		}
	}

	private onData(chunk: string) {
		this.buffer += chunk;
		while (true) {
			const newlineIndex = this.buffer.indexOf('\n');
			if (newlineIndex === -1) {
				break;
			}
			let line = this.buffer.slice(0, newlineIndex);
			this.buffer = this.buffer.slice(newlineIndex + 1);
			if (line.endsWith('\r')) {
				line = line.slice(0, -1);
			}
			const trimmed = line.trim();
			if (trimmed === '') {
				continue;
			}
			this.enqueueCommand(trimmed);
		}
	}

	private enqueueCommand(line: string) {
		this.commandQueue = this.commandQueue
			.then(() => this.handleCommand(line))
			.catch((error) => {
				this.handleUnexpectedError(error, line);
			});
	}

	private async handleCommand(rawLine: string): Promise<void> {
		const parts = rawLine.split(' ');
		const command = parts[0].toUpperCase();
		const argument =
			rawLine.length > parts[0].length
				? rawLine.slice(parts[0].length).trim()
				: '';
		const allowedWithoutAuth = new Set([
			'USER',
			'PASS',
			'QUIT',
			'NOOP',
			'SYST',
			'FEAT',
			'OPTS',
			'AUTH',
			'HELP',
			'CLNT',
		]);
		if (!this.loggedIn && !allowedWithoutAuth.has(command)) {
			this.reply(530, 'Please login with USER and PASS.');
			return;
		}
		try {
			switch (command) {
				case 'USER':
					this.handleUser(argument);
					break;
				case 'PASS':
					this.handlePass(argument);
					break;
				case 'QUIT':
					this.handleQuit();
					break;
				case 'PWD':
					this.handlePwd();
					break;
				case 'TYPE':
					this.handleType(argument);
					break;
				case 'PASV':
					await this.enterPassiveMode('PASV');
					break;
				case 'EPSV':
					await this.enterPassiveMode('EPSV');
					break;
				case 'LIST':
					await this.handleList(argument, true);
					break;
				case 'NLST':
					await this.handleList(argument, false);
					break;
				case 'CWD':
					await this.handleCwd(argument);
					break;
				case 'CDUP':
					await this.handleCwd('..');
					break;
				case 'SIZE':
					await this.handleSize(argument);
					break;
				case 'MDTM':
					await this.handleMdtm(argument);
					break;
				case 'RETR':
					await this.handleRetr(argument);
					break;
				case 'STOR':
					await this.handleStor(argument);
					break;
				case 'DELE':
					await this.handleDelete(argument);
					break;
				case 'MKD':
					await this.handleMakeDir(argument);
					break;
				case 'RMD':
					await this.handleRemoveDir(argument);
					break;
				case 'RNFR':
					await this.handleRenameFrom(argument);
					break;
				case 'RNTO':
					await this.handleRenameTo(argument);
					break;
				case 'NOOP':
					this.reply(200, 'OK');
					break;
				case 'SYST':
					this.reply(215, 'UNIX Type: L8');
					break;
				case 'FEAT':
					this.handleFeat();
					break;
				case 'OPTS':
					this.handleOpts(argument);
					break;
				case 'CLNT':
					this.reply(200, 'Noted.');
					break;
				case 'MODE':
					this.handleMode(argument);
					break;
				case 'STRU':
					this.handleStructure(argument);
					break;
				case 'EPRT':
					this.reply(
						522,
						'Network protocol not supported, use PASV or EPSV.'
					);
					break;
				case 'PORT':
					this.reply(
						502,
						'Active data connections are not supported.'
					);
					break;
				case 'AUTH':
					this.reply(502, 'TLS is not supported.');
					break;
				case 'PBSZ':
				case 'PROT':
					this.reply(502, `${command} is not supported.`);
					break;
				case 'ALLO':
					this.reply(202, 'ALLO command ignored.');
					break;
				case 'REST':
					this.reply(502, 'REST is not supported.');
					break;
				case 'SITE':
					this.reply(502, 'SITE is not supported.');
					break;
				case 'STAT':
					await this.handleStat(argument);
					break;
				case 'HELP':
					this.handleHelp();
					break;
				default:
					this.reply(502, 'Command not implemented.');
					break;
			}
		} catch (error) {
			this.handleCommandError(error, command);
		}
	}

	private handleUnexpectedError(error: unknown, line: string) {
		const command = line.split(' ')[0]?.toUpperCase() || line;
		this.handleCommandError(error, command);
	}

	private handleCommandError(error: unknown, command: string) {
		if (error instanceof FtpError) {
			this.reply(error.code, error.message);
			return;
		}
		const message =
			error instanceof Error ? error.message : String(error ?? '');
		logger.error(`FTP command ${command} failed: ${message}`);
		this.reply(451, 'Requested action aborted: local error in processing.');
	}

	private handleUser(argument: string) {
		const username = argument.trim();
		if (!username) {
			this.reply(530, 'Username required.');
			return;
		}
		this.pendingUser = username;
		this.loggedIn = false;
		this.reply(331, 'User name okay, need password.');
	}

	private handlePass(argument: string) {
		if (!this.pendingUser) {
			this.reply(503, 'Login with USER first.');
			return;
		}
		const password = argument;
		const isValid =
			this.pendingUser === this.credentials.username &&
			password === this.credentials.password;
		this.pendingUser = null;
		if (!isValid) {
			this.reply(530, 'Login incorrect.');
			return;
		}
		this.loggedIn = true;
		this.reply(230, 'Login successful.');
	}

	private handleQuit() {
		this.reply(221, 'Goodbye.');
		this.close();
	}

	private handlePwd() {
		const escaped = this.cwd.replace(/"/g, '""');
		this.reply(257, `"${escaped}" is the current directory`);
	}

	private handleType(argument: string) {
		const mode = argument.trim().toUpperCase();
		if (mode === 'I') {
			this.reply(200, 'Binary mode enabled.');
			return;
		}
		if (mode === 'A') {
			this.reply(200, 'ASCII mode enabled.');
			return;
		}
		this.reply(504, 'Requested type not supported.');
	}

	private async enterPassiveMode(mode: 'PASV' | 'EPSV') {
		await this.closePassiveServer();

		const server = createServer();
		server.maxConnections = 1;

		server.on('connection', (socket) => {
			this.dataSocket = socket;
			socket.on('close', () => {
				if (this.dataSocket === socket) {
					this.dataSocket = null;
				}
			});
			if (this.pendingData) {
				const pending = this.pendingData;
				this.pendingData = null;
				clearTimeout(pending.timer);
				pending.resolve(socket);
			}
		});

		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				server.off('error', onError);
				reject(error);
			};
			server.once('error', onError);
			server.listen(
				{
					host: this.listenHost,
					port: 0,
				},
				() => {
					server.off('error', onError);
					resolve();
				}
			);
		});

		this.passiveServer = server;
		const address = server.address();
		if (!address || typeof address === 'string') {
			throw new FtpError(425, 'Unable to determine passive address.');
		}
		this.passiveAddress = address;
		const passiveHost = this.getPassiveResponseHost(address.address);
		if (mode === 'PASV') {
			const hostParts = passiveHost
				.split('.')
				.map((part) => Number.parseInt(part, 10) || 0);
			while (hostParts.length < 4) {
				hostParts.push(0);
			}
			const p1 = Math.floor(address.port / 256);
			const p2 = address.port % 256;
			this.reply(
				227,
				`Entering Passive Mode (${hostParts
					.slice(0, 4)
					.join(',')},${p1},${p2})`
			);
		} else {
			this.reply(
				229,
				`Entering Extended Passive Mode (|||${address.port}|)`
			);
		}
	}

	private getPassiveResponseHost(address: string | undefined): string {
		if (!address) {
			return this.advertiseHost;
		}
		if (address.startsWith('::ffff:')) {
			address = address.slice('::ffff:'.length);
		}
		if (address.includes('.')) {
			return address;
		}
		return this.advertiseHost;
	}

	private async awaitDataSocket(): Promise<Socket> {
		if (this.dataSocket && !this.dataSocket.destroyed) {
			const socket = this.dataSocket;
			this.dataSocket = null;
			return socket;
		}
		if (!this.passiveServer || !this.passiveAddress) {
			throw new FtpError(425, 'Use PASV or EPSV first.');
		}
		return await new Promise<Socket>((resolve, reject) => {
			const timer = setTimeout(() => {
				if (this.pendingData === pending) {
					this.pendingData = null;
				}
				reject(new FtpError(425, 'Data connection timed out.'));
			}, 10000);
			const pending: PendingDataSocket = {
				resolve: (socket) => {
					this.pendingData = null;
					clearTimeout(timer);
					resolve(socket);
				},
				reject: (error) => {
					this.pendingData = null;
					clearTimeout(timer);
					reject(error);
				},
				timer,
			};
			this.pendingData = pending;
		});
	}

	private async handleList(argument: string, detailed: boolean) {
		const target = this.resolvePath(this.extractPathArgument(argument));
		const entries = await this.readListing(target);
		this.reply(
			150,
			detailed
				? 'Here comes the directory listing.'
				: 'Opening data connection.'
		);
		let dataSocket: Socket | null = null;
		try {
			dataSocket = await this.awaitDataSocket();
			const lines = detailed
				? entries.map((entry) => {
						const permissions = formatUnixPermissions(
							entry.mode,
							entry.isDir
						);
						const size = entry.size.toString().padStart(12, ' ');
						const date = formatUnixDate(entry.mtime);
						return `${permissions} 1 playground playground ${size} ${date} ${entry.name}`;
				  })
				: entries.map((entry) => entry.name);
			const payload = lines.join('\r\n');
			if (payload.length > 0) {
				dataSocket.write(payload + '\r\n');
			}
			dataSocket.end();
			await waitForSocketClose(dataSocket);
			this.reply(226, 'Transfer complete.');
		} finally {
			await this.closePassiveServer();
		}
	}

	private async handleCwd(argument: string) {
		const path = this.resolvePath(argument);
		if (!(await this.playground.fileExists(path))) {
			throw new FtpError(550, 'Directory does not exist.');
		}
		if (!(await this.playground.isDir(path))) {
			throw new FtpError(550, 'Not a directory.');
		}
		this.cwd = path === '' ? '/' : path;
		this.reply(250, 'Directory successfully changed.');
	}

	private async handleSize(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		const metadata = await this.getMetadata(path);
		if (!metadata || metadata.isDir) {
			throw new FtpError(550, 'Could not determine file size.');
		}
		this.reply(213, metadata.size.toString());
	}

	private async handleMdtm(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		const metadata = await this.getMetadata(path);
		if (!metadata) {
			throw new FtpError(550, 'Could not determine modification time.');
		}
		this.reply(213, formatMdtm(metadata.mtime));
	}

	private async handleRetr(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		if (!(await this.playground.fileExists(path))) {
			throw new FtpError(550, 'File unavailable.');
		}
		if (await this.playground.isDir(path)) {
			throw new FtpError(550, 'Not a plain file.');
		}
		this.reply(150, 'Opening data connection.');
		let dataSocket: Socket | null = null;
		try {
			dataSocket = await this.awaitDataSocket();
			const fileBytes = await this.playground.readFileAsBuffer(path);
			if (fileBytes && fileBytes.length) {
				dataSocket.write(Buffer.from(fileBytes));
			}
			dataSocket.end();
			await waitForSocketClose(dataSocket);
			this.reply(226, 'Transfer complete.');
		} finally {
			await this.closePassiveServer();
		}
	}

	private async handleStor(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		const parent = posixPath.dirname(path);
		if (!(await this.playground.fileExists(parent))) {
			throw new FtpError(550, 'Parent directory does not exist.');
		}
		if (!(await this.playground.isDir(parent))) {
			throw new FtpError(550, 'Parent is not a directory.');
		}
		this.reply(150, 'Opening data connection.');
		let dataSocket: Socket | null = null;
		try {
			dataSocket = await this.awaitDataSocket();
			const data = await this.readDataSocket(dataSocket);
			try {
				await this.playground.writeFile(path, data);
			} catch (error) {
				throw new FtpError(
					553,
					error instanceof Error ? error.message : 'Upload failed.'
				);
			}
			dataSocket.end();
			await waitForSocketClose(dataSocket);
			this.reply(226, 'Transfer complete.');
		} finally {
			await this.closePassiveServer();
		}
	}

	private async handleDelete(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		if (!(await this.playground.fileExists(path))) {
			throw new FtpError(550, 'File unavailable.');
		}
		if (await this.playground.isDir(path)) {
			throw new FtpError(550, 'Use RMD to remove directories.');
		}
		try {
			await this.playground.unlink(path);
		} catch (error) {
			throw new FtpError(
				450,
				error instanceof Error
					? error.message
					: 'Could not delete file.'
			);
		}
		this.reply(250, 'File deleted.');
	}

	private async handleMakeDir(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing directory name.');
		}
		const path = this.resolvePath(argument);
		if (await this.playground.fileExists(path)) {
			throw new FtpError(550, 'Directory already exists.');
		}
		try {
			await this.playground.mkdirTree(path);
		} catch (error) {
			throw new FtpError(
				550,
				error instanceof Error
					? error.message
					: 'Could not create directory.'
			);
		}
		this.reply(257, `"${path}" directory created.`);
	}

	private async handleRemoveDir(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing directory name.');
		}
		const path = this.resolvePath(argument);
		if (!(await this.playground.fileExists(path))) {
			throw new FtpError(550, 'Directory does not exist.');
		}
		if (!(await this.playground.isDir(path))) {
			throw new FtpError(550, 'Not a directory.');
		}
		const contents = await this.playground.listFiles(path);
		if (contents.length > 0) {
			throw new FtpError(550, 'Directory not empty.');
		}
		try {
			await this.playground.rmdir(path, { recursive: false });
		} catch (error) {
			throw new FtpError(
				550,
				error instanceof Error
					? error.message
					: 'Could not remove directory.'
			);
		}
		this.reply(250, 'Directory removed.');
	}

	private async handleRenameFrom(argument: string) {
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const path = this.resolvePath(argument);
		if (!(await this.playground.fileExists(path))) {
			throw new FtpError(550, 'File unavailable.');
		}
		this.renameFrom = path;
		this.reply(350, 'Requested file action pending further information.');
	}

	private async handleRenameTo(argument: string) {
		if (!this.renameFrom) {
			throw new FtpError(503, 'Use RNFR first.');
		}
		if (!argument) {
			throw new FtpError(501, 'Missing file name.');
		}
		const target = this.resolvePath(argument);
		try {
			await this.playground.mv(this.renameFrom, target);
		} catch (error) {
			this.renameFrom = null;
			throw new FtpError(
				553,
				error instanceof Error ? error.message : 'Rename failed.'
			);
		}
		this.renameFrom = null;
		this.reply(250, 'Rename successful.');
	}

	private handleFeat() {
		this.sendRaw('211-Features');
		this.sendRaw(' UTF8');
		this.sendRaw(' SIZE');
		this.sendRaw(' MDTM');
		this.sendRaw(' PASV');
		this.sendRaw(' EPSV');
		this.reply(211, 'End');
	}

	private handleOpts(argument: string) {
		if (argument.trim().toUpperCase() === 'UTF8 ON') {
			this.reply(200, 'UTF-8 mode always enabled.');
			return;
		}
		this.reply(200, 'OPT command successful.');
	}

	private handleMode(argument: string) {
		if (argument.trim().toUpperCase() === 'S') {
			this.reply(200, 'Mode set to S.');
			return;
		}
		this.reply(504, 'Only Stream mode is supported.');
	}

	private handleStructure(argument: string) {
		if (argument.trim().toUpperCase() === 'F') {
			this.reply(200, 'File structure selected.');
			return;
		}
		this.reply(504, 'Only File structure is supported.');
	}

	private async handleStat(argument: string) {
		if (!argument) {
			this.sendRaw('211-WordPress Playground FTP status:');
			this.sendRaw(` Current directory: ${this.cwd}`);
			this.sendRaw(' Passive mode only.');
			this.reply(211, 'End of status.');
			return;
		}
		const path = this.resolvePath(argument);
		const metadata = await this.getMetadata(path);
		if (!metadata) {
			throw new FtpError(550, 'Status not available.');
		}
		this.sendRaw('213-Status follows');
		this.sendRaw(` Path: ${metadata.path}`);
		this.sendRaw(` Type: ${metadata.isDir ? 'directory' : 'file'}`);
		this.sendRaw(` Size: ${metadata.size}`);
		this.sendRaw(
			` Modified: ${new Date(metadata.mtime * 1000).toISOString()}`
		);
		this.reply(213, 'End of status.');
	}

	private handleHelp() {
		this.sendRaw('214-Available commands:');
		this.sendRaw(
			' USER PASS QUIT PWD TYPE PASV EPSV LIST NLST CWD CDUP SIZE MDTM'
		);
		this.sendRaw(' RETR STOR DELE MKD RMD RNFR RNTO NOOP SYST FEAT OPTS');
		this.reply(214, 'End of help.');
	}

	private extractPathArgument(argument: string): string {
		if (!argument) {
			return '';
		}
		let trimmed = argument.trim();
		if (trimmed === '') {
			return '';
		}
		if (
			(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))
		) {
			return trimmed.slice(1, -1);
		}
		if (trimmed.startsWith('-')) {
			const parts = trimmed
				.split(/\s+/)
				.filter((token) => token.length > 0 && !token.startsWith('-'));
			return parts.join(' ');
		}
		return trimmed;
	}

	private resolvePath(rawPath: string): string {
		if (!rawPath) {
			return this.cwd;
		}
		let normalized = rawPath.replace(/\\/g, '/');
		if (!normalized.startsWith('/')) {
			normalized = posixPath.join(this.cwd, normalized);
		}
		normalized = posixPath.normalize(normalized);
		if (!normalized.startsWith('/')) {
			normalized = `/${normalized}`;
		}
		return normalized === '' ? '/' : normalized;
	}

	private async readListing(path: string): Promise<FileMetadata[]> {
		const exists = await this.playground.fileExists(path);
		if (!exists) {
			throw new FtpError(
				550,
				'Requested action not taken. File unavailable.'
			);
		}
		if (await this.playground.isDir(path)) {
			const names = await this.playground.listFiles(path);
			const fullPaths = names.map((name) => posixPath.join(path, name));
			return await this.fetchMetadata(fullPaths);
		}
		return await this.fetchMetadata([path]);
	}

	private async fetchMetadata(paths: string[]): Promise<FileMetadata[]> {
		if (paths.length === 0) {
			return [];
		}
		const encodedPaths = JSON.stringify(paths);
		const script = `<?php
$paths = json_decode('${escapeForPhpSingleQuote(encodedPaths)}', true);
$result = [];
foreach ($paths as $path) {
	if (!file_exists($path)) {
		continue;
	}
	$stat = @stat($path);
	if ($stat === false) {
		continue;
	}
	$result[] = [
		'path' => $path,
		'name' => basename($path),
		'isDir' => is_dir($path),
		'size' => (int) $stat['size'],
		'mtime' => (int) $stat['mtime'],
		'mode' => (int) $stat['mode'],
	];
}
echo json_encode($result);
?>`;
		const response = await this.playground.run({ code: script });
		const text = textDecoder.decode(response.bytes);
		if (!text) {
			return [];
		}
		try {
			return JSON.parse(text) as FileMetadata[];
		} catch {
			return [];
		}
	}

	private async getMetadata(path: string): Promise<FileMetadata | null> {
		const result = await this.fetchMetadata([path]);
		return result[0] ?? null;
	}

	private async readDataSocket(socket: Socket): Promise<Uint8Array> {
		return await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			socket.on('data', (chunk: Buffer) => {
				chunks.push(
					Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
				);
			});
			socket.once('error', (error) => reject(error));
			socket.once('end', () => resolve(Buffer.concat(chunks)));
		});
	}

	private async closePassiveServer(): Promise<void> {
		if (this.pendingData) {
			clearTimeout(this.pendingData.timer);
			this.pendingData.reject(
				new FtpError(426, 'Data connection closed.')
			);
			this.pendingData = null;
		}
		if (this.dataSocket && !this.dataSocket.destroyed) {
			this.dataSocket.destroy();
		}
		this.dataSocket = null;
		if (this.passiveServer) {
			await new Promise<void>((resolve) => {
				this.passiveServer?.close(() => resolve());
			});
		}
		this.passiveServer = null;
		this.passiveAddress = null;
	}

	private sendRaw(line: string) {
		if (this.closed) {
			return;
		}
		this.socket.write(`${line}\r\n`);
	}

	private reply(code: number, message: string) {
		if (this.closed) {
			return;
		}
		this.socket.write(`${code} ${message}\r\n`);
	}
}

function normalizeAdvertisedHost(host: string): string {
	if (
		host === '0.0.0.0' ||
		host === '::' ||
		host.toLowerCase() === 'localhost'
	) {
		return '127.0.0.1';
	}
	if (host.includes(':')) {
		return '127.0.0.1';
	}
	return host;
}

export async function startFtpServer(
	options: StartFtpServerOptions
): Promise<PlaygroundFtpServer> {
	const listenHost = options.host ?? '127.0.0.1';
	const advertiseHost = normalizeAdvertisedHost(listenHost);
	const username = options.username ?? 'playground';
	const password = options.password ?? randomBytes(12).toString('hex');

	const sessions = new Set<FtpSession>();
	const server = createServer((socket) => {
		const session = new FtpSession({
			socket,
			playground: options.playground,
			listenHost,
			advertiseHost,
			credentials: { username, password },
		});
		sessions.add(session);
		socket.on('close', () => {
			sessions.delete(session);
		});
	});

	await new Promise<void>((resolve, reject) => {
		const onError = (error: Error) => {
			server.off('error', onError);
			reject(error);
		};
		server.once('error', onError);
		server.listen(
			{
				host: listenHost,
				port: options.port ?? 0,
			},
			() => {
				server.off('error', onError);
				resolve();
			}
		);
	});

	server.on('error', (error) => {
		logger.error(`FTP server error: ${error.message}`);
	});

	const addressInfo = server.address();
	if (!addressInfo || typeof addressInfo === 'string') {
		throw new Error('Failed to determine FTP server address.');
	}

	return {
		address: {
			host: advertiseHost,
			port: addressInfo.port,
		},
		credentials: { username, password },
		close: async () => {
			for (const session of sessions) {
				session.close();
			}
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
		},
	};
}
