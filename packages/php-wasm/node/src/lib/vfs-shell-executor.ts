import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
// TypeScript's legacy Node resolution cannot follow this valid package export.
// @ts-ignore Types are supplied by the package's main export below.
import { Bash, defineCommand } from 'just-bash/browser';
import type {
	Bash as BashClass,
	defineCommand as defineCommandFunction,
	FsStat,
	IFileSystem,
} from 'just-bash';
import { minimatch } from 'minimatch';
import type {
	PHPFileSystem,
	SandboxedShellExecutor,
} from '@php-wasm/universal';

const BrowserBash: typeof BashClass = Bash;
const defineVfsCommand: typeof defineCommandFunction = defineCommand;

function resolvePath(base: string, path: string) {
	const resolved: string[] = [];
	for (const part of (path.startsWith('/') ? path : `${base}/${path}`).split(
		'/'
	)) {
		if (!part || part === '.') continue;
		if (part === '..') resolved.pop();
		else resolved.push(part);
	}
	return `/${resolved.join('/')}`;
}

function phpFileSystem(php: PHPFileSystem): IFileSystem {
	const readBinary = async (path: string) =>
		Array.from(await php.readFileAsBuffer(path), (byte) =>
			String.fromCharCode(byte)
		).join('');
	const stat = async (path: string, follow = true): Promise<FsStat> => {
		const entry = await php.stat(path, follow);
		return { ...entry, mtime: new Date(entry.mtime) };
	};
	return {
		readFile: async (path, encoding) => {
			const bytes = await php.readFileAsBuffer(path);
			return encoding === 'binary' || encoding === 'latin1'
				? Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
						''
					)
				: new TextDecoder().decode(bytes);
		},
		readFileBytes: async (path) => (await readBinary(path)) as never,
		readFileBuffer: async (path) => await php.readFileAsBuffer(path),
		writeFile: async (path, content) => await php.writeFile(path, content),
		async appendFile(path, content) {
			let existing = new Uint8Array();
			try {
				existing = await php.readFileAsBuffer(path);
			} catch {
				// Appending to a missing file starts with empty content.
			}
			const appended =
				typeof content === 'string'
					? new TextEncoder().encode(content)
					: content;
			const combined = new Uint8Array(existing.length + appended.length);
			combined.set(existing);
			combined.set(appended, existing.length);
			await php.writeFile(path, combined);
		},
		exists: async (path) => await php.fileExists(path),
		stat,
		mkdir: async (path, options) =>
			options?.recursive
				? await php.mkdirTree(path)
				: await php.mkdir(path),
		readdir: async (path) => await php.listFiles(path),
		async readdirWithFileTypes(path) {
			return await Promise.all(
				(await php.listFiles(path)).map(async (name) => {
					const entry = await stat(resolvePath(path, name), false);
					return {
						name,
						isFile: entry.isFile,
						isDirectory: entry.isDirectory,
						isSymbolicLink: entry.isSymbolicLink,
					};
				})
			);
		},
		async rm(path, options) {
			let entry: FsStat;
			try {
				entry = await stat(path, false);
			} catch (error) {
				if (options?.force) return;
				throw error;
			}
			if (entry.isDirectory)
				await php.rmdir(path, { recursive: options?.recursive });
			else await php.unlink(path);
		},
		async cp(source, destination, options) {
			if (!options?.recursive && (await stat(source)).isDirectory)
				throw new Error(
					`Cannot copy directory without recursive: ${source}`
				);
			await php.cp(source, destination);
		},
		mv: async (source, destination) => await php.mv(source, destination),
		resolvePath,
		getAllPaths: () => [],
		chmod: async (path, mode) => await php.chmod(path, mode),
		symlink: async (target, path) => await php.symlink(target, path),
		async link() {
			throw new Error(
				'Hard links are not supported by the PHP virtual filesystem'
			);
		},
		readlink: async (path) => await php.readlink(path),
		lstat: async (path) => await stat(path, false),
		realpath: async (path) => await php.realpath(path),
		utimes: async (path, atime, mtime) =>
			await php.utimes(path, atime.getTime(), mtime.getTime()),
	};
}

function deploymentCommands() {
	return [
		defineVfsCommand('unzip', async (args, context) => {
			const destinationIndex = args.indexOf('-d');
			const zipPath = args.find(
				(arg, index) =>
					!arg.startsWith('-') && index !== destinationIndex + 1
			);
			const destinationArgument =
				destinationIndex === -1
					? context.cwd
					: args[destinationIndex + 1];
			if (!zipPath || !destinationArgument)
				return {
					stdout: '',
					stderr: 'unzip: usage: unzip [-o] ZIP -d DEST\n',
					exitCode: 2,
				};
			const destination = context.fs.resolvePath(
				context.cwd,
				destinationArgument
			);
			const archive = await context.fs.readFileBuffer(
				context.fs.resolvePath(context.cwd, zipPath)
			);
			const reader = new ZipReader(new BlobReader(new Blob([archive])));
			try {
				for (const entry of await reader.getEntries()) {
					const path = context.fs.resolvePath(
						destination,
						entry.filename
					);
					if (!path.startsWith(`${destination.replace(/\/$/, '')}/`))
						return {
							stdout: '',
							stderr: `unzip: unsafe path: ${entry.filename}\n`,
							exitCode: 1,
						};
					if (entry.directory)
						await context.fs.mkdir(path, { recursive: true });
					else {
						await context.fs.mkdir(
							path.slice(0, path.lastIndexOf('/')) || '/',
							{ recursive: true }
						);
						await context.fs.writeFile(
							path,
							await entry.getData!(new Uint8ArrayWriter())
						);
					}
				}
				return { stdout: '', stderr: '', exitCode: 0 };
			} finally {
				await reader.close();
			}
		}),
		defineVfsCommand('mktemp', async (args, context) => {
			const directory = args.includes('-d');
			const parent = args.includes('-p')
				? args[args.indexOf('-p') + 1]
				: '/tmp';
			const template =
				args.find(
					(arg, index) =>
						!arg.startsWith('-') && args[index - 1] !== '-p'
				) ?? 'tmp.XXXXXX';
			for (let attempt = 0; attempt < 100; attempt++) {
				const path = context.fs.resolvePath(
					context.cwd,
					`${parent}/${template.replace(/X{3,}/, Math.random().toString(36).slice(2, 8))}`
				);
				if (await context.fs.exists(path)) continue;
				if (directory) await context.fs.mkdir(path);
				else await context.fs.writeFile(path, '');
				return { stdout: `${path}\n`, stderr: '', exitCode: 0 };
			}
			return {
				stdout: '',
				stderr: 'mktemp: failed to create file\n',
				exitCode: 1,
			};
		}),
		defineVfsCommand('date', async (args) => ({
			stdout: `${args[0] === '--iso-8601=seconds' ? new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00') : new Date().toString()}\n`,
			stderr: '',
			exitCode: 0,
		})),
		defineVfsCommand('rmdir', async (args, context) => {
			for (const path of args.filter((arg) => !arg.startsWith('-'))) {
				try {
					await context.fs.rm(
						context.fs.resolvePath(context.cwd, path)
					);
				} catch (error) {
					if (!args.includes('--ignore-fail-on-non-empty'))
						return {
							stdout: '',
							stderr: `rmdir: ${error}\n`,
							exitCode: 1,
						};
				}
			}
			return { stdout: '', stderr: '', exitCode: 0 };
		}),
		defineVfsCommand('jq', async (args, context) => {
			const bindings = new Map<string, unknown>();
			const forwarded: string[] = [];
			for (let index = 0; index < args.length; index++) {
				if (args[index] === '--arg') {
					if (index + 2 >= args.length)
						return {
							stdout: '',
							stderr: 'jq: --arg requires two arguments\n',
							exitCode: 2,
						};
					if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(args[index + 1]))
						return {
							stdout: '',
							stderr: `jq: invalid variable name ${args[index + 1]}\n`,
							exitCode: 2,
						};
					bindings.set(args[index + 1], args[index + 2]);
					index += 2;
				} else if (args[index] === '--slurpfile') {
					if (index + 2 >= args.length)
						return {
							stdout: '',
							stderr: 'jq: --slurpfile requires two arguments\n',
							exitCode: 2,
						};
					if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(args[index + 1]))
						return {
							stdout: '',
							stderr: `jq: invalid variable name ${args[index + 1]}\n`,
							exitCode: 2,
						};
					const contents = await context.fs.readFile(
						context.fs.resolvePath(context.cwd, args[index + 2])
					);
					try {
						bindings.set(args[index + 1], [JSON.parse(contents)]);
					} catch {
						return {
							stdout: '',
							stderr: `jq: invalid JSON in ${args[index + 2]}\n`,
							exitCode: 4,
						};
					}
					index += 2;
				} else forwarded.push(args[index]);
			}
			const filterIndex = forwarded.findIndex(
				(argument) => !argument.startsWith('-')
			);
			if (filterIndex !== -1) {
				for (const [name, value] of bindings) {
					forwarded[filterIndex] = forwarded[filterIndex].replace(
						new RegExp(`\\$${name}\\b`, 'g'),
						JSON.stringify(value)
					);
				}
			}
			return await new BrowserBash({
				fs: context.fs,
				cwd: context.cwd,
				env: Object.fromEntries(context.env),
			}).exec(`jq ${forwarded.map(quote).join(' ')}`, {
				stdin: context.stdin as unknown as string,
			});
		}),
		defineVfsCommand('rsync', async (args, context) => {
			const paths: string[] = [];
			let excludeFile: string | undefined;
			let logFile: string | undefined;
			for (let index = 0; index < args.length; index++) {
				const arg = args[index];
				if (arg.startsWith('--exclude-from='))
					excludeFile = arg.slice(15);
				else if (arg === '--exclude-from') excludeFile = args[++index];
				else if (arg.startsWith('--log-file=')) logFile = arg.slice(11);
				else if (arg === '--log-file') logFile = args[++index];
				else if (!arg.startsWith('-')) paths.push(arg);
			}
			const [sourceArgument, destinationArgument] = paths.slice(-2);
			if (!sourceArgument || !destinationArgument)
				return {
					stdout: '',
					stderr: 'rsync: missing source or destination\n',
					exitCode: 1,
				};
			const excludes = excludeFile
				? (
						await context.fs.readFile(
							context.fs.resolvePath(context.cwd, excludeFile)
						)
					)
						.split(/\r?\n/)
						.filter(Boolean)
				: [];
			const ignored = (path: string) =>
				excludes.some((pattern) =>
					minimatch(path, pattern.replace(/^\//, ''), { dot: true })
				);
			const source = context.fs.resolvePath(context.cwd, sourceArgument);
			const destination = context.fs.resolvePath(
				context.cwd,
				destinationArgument
			);
			const copied = new Set<string>();
			const lines: string[] = [];
			const copy = async (
				from: string,
				to: string,
				relative: string
			): Promise<void> => {
				if (ignored(relative)) return;
				copied.add(relative);
				const entry = await context.fs.lstat(from);
				if (entry.isDirectory) {
					await context.fs.mkdir(to, { recursive: true });
					if (relative) lines.push(`cd+++++++++ ${relative}/`);
					for (const child of await context.fs.readdir(from))
						await copy(
							`${from}/${child}`,
							`${to}/${child}`,
							relative ? `${relative}/${child}` : child
						);
				} else if (entry.isSymbolicLink) {
					await context.fs.symlink(
						await context.fs.readlink(from),
						to
					);
					lines.push(`cL+++++++++ ${relative}`);
				} else {
					await context.fs.mkdir(
						to.slice(0, to.lastIndexOf('/')) || '/',
						{ recursive: true }
					);
					await context.fs.writeFile(
						to,
						await context.fs.readFileBuffer(from)
					);
					await context.fs.chmod(to, entry.mode);
					lines.push(`>f+++++++++ ${relative}`);
				}
			};
			await context.fs.mkdir(destination, { recursive: true });
			if (
				(await context.fs.lstat(source)).isDirectory &&
				sourceArgument.endsWith('/')
			) {
				for (const child of await context.fs.readdir(source))
					await copy(
						`${source}/${child}`,
						`${destination}/${child}`,
						child
					);
			} else
				await copy(
					source,
					`${destination}/${source.split('/').pop()}`,
					source.split('/').pop()!
				);
			if (args.includes('--delete-after') || args.includes('--delete')) {
				const removeMissing = async (
					path: string,
					relative: string
				): Promise<void> => {
					if (ignored(relative) || copied.has(relative)) return;
					const entry = await context.fs.lstat(path);
					if (entry.isDirectory) {
						for (const child of await context.fs.readdir(path))
							await removeMissing(
								`${path}/${child}`,
								relative ? `${relative}/${child}` : child
							);
						if (!copied.has(relative))
							await context.fs.rm(path, { recursive: true });
					} else {
						await context.fs.rm(path);
						lines.push(`*deleting   ${relative}`);
					}
				};
				for (const child of await context.fs.readdir(destination))
					await removeMissing(`${destination}/${child}`, child);
			}
			const output = lines.length ? `${lines.join('\n')}\n` : '';
			if (logFile)
				await context.fs.writeFile(
					context.fs.resolvePath(context.cwd, logFile),
					output
				);
			return { stdout: output, stderr: '', exitCode: 0 };
		}),
	];
}

const quote = (argument: string) => `'${argument.replace(/'/g, "'\\''")}'`;

/**
 * Runs just-bash exclusively against a PHP VFS; it never invokes Node
 * processes or filesystem APIs.
 */
export const vfsShellExecutor: SandboxedShellExecutor = async ({
	args,
	command: commandString,
	php,
	processApi,
	options,
}) => {
	const stdin: Uint8Array[] = [];
	processApi.on('stdin', (chunk: Uint8Array) => stdin.push(chunk));
	if (!processApi.childProcess.stdin.ended) {
		// shell_exec() keeps its input pipe open. Yield one turn after registering
		// the listener so proc_open() can deliver its initial writes without waiting
		// for an EOF that a command without stdin will never send.
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
	const filesystem = phpFileSystem(php);
	const cwd = options.cwd ?? (await php.cwd());
	let command =
		commandString ??
		(args[0] === '/bin/sh' && args[1] === '-c'
			? args[2]
			: args.map(quote).join(' '));
	if (args[0] && args[0] !== '/bin/sh') {
		const scriptPath = filesystem.resolvePath(cwd, args[0]);
		try {
			const script = await filesystem.readFile(scriptPath);
			if (
				script.startsWith('#!') &&
				(await filesystem.stat(scriptPath)).mode & 0o111
			) {
				command = `set -- ${args.slice(1).map(quote).join(' ')}\n${script.replace(/^#![^\n]*\n?/, '')}`;
			}
		} catch {
			// Non-script commands continue through normal shell resolution.
		}
	}
	const result = await new BrowserBash({
		fs: filesystem,
		cwd,
		env: { ...options.env, SHELL_PIPE: '0' },
		customCommands: deploymentCommands(),
		executionLimits: {
			maxCommandCount: 10_000,
			maxOutputSize: 10 * 1024 * 1024,
		},
	}).exec(command, {
		stdin: new TextDecoder().decode(
			Uint8Array.from(stdin.flatMap((chunk) => [...chunk]))
		),
	});
	if (result.stdout) processApi.stdout(result.stdout);
	if (result.stderr) processApi.stderr(result.stderr);
	processApi.exit(result.exitCode);
};
