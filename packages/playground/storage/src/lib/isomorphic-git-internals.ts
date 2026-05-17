/* eslint-disable */
// @ts-nocheck
/**
 * Local copy of the small subset of isomorphic-git internals used by
 * git-sparse-checkout.ts. The npm package does not publish these modules
 * under isomorphic-git/src/*, so importing them directly breaks Vite builds.
 *
 * Source: isomorphic-git 1.37.6 (MIT).
 */
import crc32 from 'crc-32';
import pako from 'pako';
import Hash from 'sha.js/sha1.js';

// webpack://git/./src/utils/fromValue.js
// Convert a value to an Async Iterator
// This will be easier with async generator functions.
export function fromValue(value) {
	let queue = [value];
	return {
		next() {
			return Promise.resolve({
				done: queue.length === 0,
				value: queue.pop(),
			});
		},
		return() {
			queue = [];
			return {};
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	};
}

// webpack://git/./src/utils/getIterator.js
export function getIterator(iterable) {
	if (iterable[Symbol.asyncIterator]) {
		return iterable[Symbol.asyncIterator]();
	}
	if (iterable[Symbol.iterator]) {
		return iterable[Symbol.iterator]();
	}
	if (iterable.next) {
		return iterable;
	}
	return fromValue(iterable);
}

// webpack://git/./src/utils/StreamReader.js
// inspired by 'gartal' but lighter-weight and more battle-tested.
export class StreamReader {
	constructor(stream) {
		// TODO: fix usage in bundlers before Buffer dependency is removed #1855
		if (typeof Buffer === 'undefined') {
			throw new Error('Missing Buffer dependency');
		}
		this.stream = getIterator(stream);
		this.buffer = null;
		this.cursor = 0;
		this.undoCursor = 0;
		this.started = false;
		this._ended = false;
		this._discardedBytes = 0;
	}

	eof() {
		return this._ended && this.cursor === this.buffer.length;
	}

	tell() {
		return this._discardedBytes + this.cursor;
	}

	async byte() {
		if (this.eof()) return;
		if (!this.started) await this._init();
		if (this.cursor === this.buffer.length) {
			await this._loadnext();
			if (this._ended) return;
		}
		this._moveCursor(1);
		return this.buffer[this.undoCursor];
	}

	async chunk() {
		if (this.eof()) return;
		if (!this.started) await this._init();
		if (this.cursor === this.buffer.length) {
			await this._loadnext();
			if (this._ended) return;
		}
		this._moveCursor(this.buffer.length);
		return this.buffer.slice(this.undoCursor, this.cursor);
	}

	async read(n) {
		if (this.eof()) return;
		if (!this.started) await this._init();
		if (this.cursor + n > this.buffer.length) {
			this._trim();
			await this._accumulate(n);
		}
		this._moveCursor(n);
		return this.buffer.slice(this.undoCursor, this.cursor);
	}

	async skip(n) {
		if (this.eof()) return;
		if (!this.started) await this._init();
		if (this.cursor + n > this.buffer.length) {
			this._trim();
			await this._accumulate(n);
		}
		this._moveCursor(n);
	}

	async undo() {
		this.cursor = this.undoCursor;
	}

	async _next() {
		this.started = true;
		let { done, value } = await this.stream.next();
		if (done) {
			this._ended = true;
			if (!value) return Buffer.alloc(0);
		}
		if (value) {
			value = Buffer.from(value);
		}
		return value;
	}

	_trim() {
		// Throw away parts of the buffer we don't need anymore
		// assert(this.cursor <= this.buffer.length)
		this.buffer = this.buffer.slice(this.undoCursor);
		this.cursor -= this.undoCursor;
		this._discardedBytes += this.undoCursor;
		this.undoCursor = 0;
	}

	_moveCursor(n) {
		this.undoCursor = this.cursor;
		this.cursor += n;
		if (this.cursor > this.buffer.length) {
			this.cursor = this.buffer.length;
		}
	}

	async _accumulate(n) {
		if (this._ended) return;
		// Expand the buffer until we have N bytes of data
		// or we've reached the end of the stream
		const buffers = [this.buffer];
		while (this.cursor + n > lengthBuffers(buffers)) {
			const nextbuffer = await this._next();
			if (this._ended) break;
			buffers.push(nextbuffer);
		}
		this.buffer = Buffer.concat(buffers);
	}

	async _loadnext() {
		this._discardedBytes += this.buffer.length;
		this.undoCursor = 0;
		this.cursor = 0;
		this.buffer = await this._next();
	}

	async _init() {
		this.buffer = await this._next();
	}
}

// This helper function helps us postpone concatenating buffers, which
// would create intermediate buffer objects,
function lengthBuffers(buffers) {
	return buffers.reduce((acc, buffer) => acc + buffer.length, 0);
}

// webpack://git/./src/utils/padHex.js
export function padHex(b, n) {
	const s = n.toString(16);
	return '0'.repeat(b - s.length) + s;
}

// webpack://git/./src/models/GitPktLine.js
/**
pkt-line Format
---------------

Much (but not all) of the payload is described around pkt-lines.

A pkt-line is a variable length binary string.  The first four bytes
of the line, the pkt-len, indicates the total length of the line,
in hexadecimal.  The pkt-len includes the 4 bytes used to contain
the length's hexadecimal representation.

A pkt-line MAY contain binary data, so implementers MUST ensure
pkt-line parsing/formatting routines are 8-bit clean.

A non-binary line SHOULD BE terminated by an LF, which if present
MUST be included in the total length. Receivers MUST treat pkt-lines
with non-binary data the same whether or not they contain the trailing
LF (stripping the LF if present, and not complaining when it is
missing).

The maximum length of a pkt-line's data component is 65516 bytes.
Implementations MUST NOT send pkt-line whose length exceeds 65520
(65516 bytes of payload + 4 bytes of length data).

Implementations SHOULD NOT send an empty pkt-line ("0004").

A pkt-line with a length field of 0 ("0000"), called a flush-pkt,
is a special case and MUST be handled differently than an empty
pkt-line ("0004").

----
  pkt-line     =  data-pkt / flush-pkt

  data-pkt     =  pkt-len pkt-payload
  pkt-len      =  4*(HEXDIG)
  pkt-payload  =  (pkt-len - 4)*(OCTET)

  flush-pkt    = "0000"
----

Examples (as C-style strings):

----
  pkt-line          actual value
  ---------------------------------
  "0006a\n"         "a\n"
  "0005a"           "a"
  "000bfoobar\n"    "foobar\n"
  "0004"            ""
----
*/

// I'm really using this more as a namespace.
// There's not a lot of "state" in a pkt-line

export class GitPktLine {
	static flush() {
		return Buffer.from('0000', 'utf8');
	}

	static delim() {
		return Buffer.from('0001', 'utf8');
	}

	static encode(line) {
		if (typeof line === 'string') {
			line = Buffer.from(line);
		}
		const length = line.length + 4;
		const hexlength = padHex(4, length);
		return Buffer.concat([Buffer.from(hexlength, 'utf8'), line]);
	}

	static streamReader(stream) {
		const reader = new StreamReader(stream);
		return async function read() {
			try {
				let length = await reader.read(4);
				if (length == null) return true;
				length = parseInt(length.toString('utf8'), 16);
				if (length === 0) return null;
				if (length === 1) return null; // delim packets
				const buffer = await reader.read(length - 4);
				if (buffer == null) return true;
				return buffer;
			} catch (err) {
				stream.error = err;
				return true;
			}
		};
	}
}

// webpack://git/./src/errors/BaseError.js
export class BaseError extends Error {
	constructor(message) {
		super(message);
		// Setting this here allows TS to infer that all git errors have a `caller` property and
		// that its type is string.
		this.caller = '';
	}

	toJSON() {
		// Error objects aren't normally serializable. So we do something about that.
		return {
			code: this.code,
			data: this.data,
			caller: this.caller,
			message: this.message,
			stack: this.stack,
		};
	}

	fromJSON(json) {
		const e = new BaseError(json.message);
		e.code = json.code;
		e.data = json.data;
		e.caller = json.caller;
		e.stack = json.stack;
		return e;
	}

	get isIsomorphicGitError() {
		return true;
	}
}

// webpack://git/./src/errors/InternalError.js
export class InternalError extends BaseError {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(
			`An internal error caused this command to fail.\n\nIf you're not a developer, report the bug to the developers of the application you're using. If this is a bug in isomorphic-git then you should create a proper bug yourselves. The bug should include a minimal reproduction and details about the version and environment.\n\nPlease file a bug report at https://github.com/isomorphic-git/isomorphic-git/issues with this error message: ${message}`
		);
		this.code = this.name = InternalError.code;
		this.data = { message };
	}
}
/** @type {'InternalError'} */
InternalError.code = 'InternalError';

// webpack://git/./src/errors/UnsafeFilepathError.js
export class UnsafeFilepathError extends BaseError {
	/**
	 * @param {string} filepath
	 */
	constructor(filepath) {
		super(`The filepath "${filepath}" contains unsafe character sequences`);
		this.code = this.name = UnsafeFilepathError.code;
		this.data = { filepath };
	}
}
/** @type {'UnsafeFilepathError'} */
UnsafeFilepathError.code = 'UnsafeFilepathError';

// webpack://git/./src/utils/compareStrings.js
export function compareStrings(a, b) {
	// https://stackoverflow.com/a/40355107/2168416
	return -(a < b) || +(a > b);
}

// webpack://git/./src/utils/comparePath.js
export function comparePath(a, b) {
	// https://stackoverflow.com/a/40355107/2168416
	return compareStrings(a.path, b.path);
}

// webpack://git/./src/utils/compareTreeEntryPath.js
export function compareTreeEntryPath(a, b) {
	// Git sorts tree entries as if there is a trailing slash on directory names.
	return compareStrings(appendSlashIfDir(a), appendSlashIfDir(b));
}

function appendSlashIfDir(entry) {
	return entry.mode === '040000' ? entry.path + '/' : entry.path;
}

// webpack://git/./src/models/GitTree.js
/**
 *
 * @typedef {Object} TreeEntry
 * @property {string} mode - the 6 digit hexadecimal mode
 * @property {string} path - the name of the file or directory
 * @property {string} oid - the SHA-1 object id of the blob or tree
 * @property {'commit'|'blob'|'tree'} type - the type of object
 */

function mode2type(mode) {
	// prettier-ignore
	switch (mode) {
    case '040000': return 'tree'
    case '100644': return 'blob'
    case '100755': return 'blob'
    case '120000': return 'blob'
    case '160000': return 'commit'
  }
	throw new InternalError(`Unexpected GitTree entry mode: ${mode}`);
}

function parseBuffer(buffer) {
	const _entries = [];
	let cursor = 0;
	while (cursor < buffer.length) {
		const space = buffer.indexOf(32, cursor);
		if (space === -1) {
			throw new InternalError(
				`GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
			);
		}
		const nullchar = buffer.indexOf(0, cursor);
		if (nullchar === -1) {
			throw new InternalError(
				`GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
			);
		}
		let mode = buffer.slice(cursor, space).toString('utf8');
		if (mode === '40000') mode = '040000'; // makes it line up neater in printed output
		const type = mode2type(mode);
		const path = buffer.slice(space + 1, nullchar).toString('utf8');

		// Prevent malicious git repos from writing to "..\foo" on clone etc
		if (path.includes('\\') || path.includes('/')) {
			throw new UnsafeFilepathError(path);
		}

		const oid = buffer.slice(nullchar + 1, nullchar + 21).toString('hex');
		cursor = nullchar + 21;
		_entries.push({ mode, path, oid, type });
	}
	return _entries;
}

function limitModeToAllowed(mode) {
	if (typeof mode === 'number') {
		mode = mode.toString(8);
	}
	// tree
	if (mode.match(/^0?4.*/)) return '040000'; // Directory
	if (mode.match(/^1006.*/)) return '100644'; // Regular non-executable file
	if (mode.match(/^1007.*/)) return '100755'; // Regular executable file
	if (mode.match(/^120.*/)) return '120000'; // Symbolic link
	if (mode.match(/^160.*/)) return '160000'; // Commit (git submodule reference)
	throw new InternalError(`Could not understand file mode: ${mode}`);
}

function nudgeIntoShape(entry) {
	if (!entry.oid && entry.sha) {
		entry.oid = entry.sha; // Github
	}
	entry.mode = limitModeToAllowed(entry.mode); // index
	if (!entry.type) {
		entry.type = mode2type(entry.mode); // index
	}
	return entry;
}

export class GitTree {
	constructor(entries) {
		if (Buffer.isBuffer(entries)) {
			this._entries = parseBuffer(entries);
		} else if (Array.isArray(entries)) {
			this._entries = entries.map(nudgeIntoShape);
		} else {
			throw new InternalError(
				'invalid type passed to GitTree constructor'
			);
		}
		// Tree entries are not sorted alphabetically in the usual sense (see `compareTreeEntryPath`)
		// but it is important later on that these be sorted in the same order as they would be returned from readdir.
		this._entries.sort(comparePath);
	}

	static from(tree) {
		return new GitTree(tree);
	}

	render() {
		return this._entries
			.map(
				(entry) =>
					`${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`
			)
			.join('\n');
	}

	toObject() {
		// Adjust the sort order to match git's
		const entries = [...this._entries];
		entries.sort(compareTreeEntryPath);
		return Buffer.concat(
			entries.map((entry) => {
				const mode = Buffer.from(entry.mode.replace(/^0/, ''));
				const space = Buffer.from(' ');
				const path = Buffer.from(entry.path, 'utf8');
				const nullchar = Buffer.from([0]);
				const oid = Buffer.from(entry.oid, 'hex');
				return Buffer.concat([mode, space, path, nullchar, oid]);
			})
		);
	}

	/**
	 * @returns {TreeEntry[]}
	 */
	entries() {
		return this._entries;
	}

	*[Symbol.iterator]() {
		for (const entry of this._entries) {
			yield entry;
		}
	}
}

// webpack://git/./src/utils/formatAuthor.js
export function formatAuthor({ name, email, timestamp, timezoneOffset }) {
	timezoneOffset = formatTimezoneOffset(timezoneOffset);
	return `${name} <${email}> ${timestamp} ${timezoneOffset}`;
}

// The amount of effort that went into crafting these cases to handle
// -0 (just so we don't lose that information when parsing and reconstructing)
// but can also default to +0 was extraordinary.

function formatTimezoneOffset(minutes) {
	const sign = simpleSign(negateExceptForZero(minutes));
	minutes = Math.abs(minutes);
	const hours = Math.floor(minutes / 60);
	minutes -= hours * 60;
	let strHours = String(hours);
	let strMinutes = String(minutes);
	if (strHours.length < 2) strHours = '0' + strHours;
	if (strMinutes.length < 2) strMinutes = '0' + strMinutes;
	return (sign === -1 ? '-' : '+') + strHours + strMinutes;
}

function simpleSign(n) {
	return Math.sign(n) || (Object.is(n, -0) ? -1 : 1);
}

function negateExceptForZero(n) {
	return n === 0 ? n : -n;
}

// webpack://git/./src/utils/indent.js
export function indent(str) {
	return (
		str
			.trim()
			.split('\n')
			.map((x) => ' ' + x)
			.join('\n') + '\n'
	);
}

// webpack://git/./src/utils/normalizeNewlines.js
export function normalizeNewlines(str) {
	// remove all <CR>
	str = str.replace(/\r/g, '');
	// no extra newlines up front
	str = str.replace(/^\n+/, '');
	// and a single newline at the end
	str = str.replace(/\n+$/, '') + '\n';
	return str;
}

// webpack://git/./src/utils/outdent.js
export function outdent(str) {
	return str
		.split('\n')
		.map((x) => x.replace(/^ /, ''))
		.join('\n');
}

// webpack://git/./src/utils/parseAuthor.js
export function parseAuthor(author) {
	const [, name, email, timestamp, offset] = author.match(
		/^(.*) <(.*)> (.*) (.*)$/
	);
	return {
		name,
		email,
		timestamp: Number(timestamp),
		timezoneOffset: parseTimezoneOffset(offset),
	};
}

// The amount of effort that went into crafting these cases to handle
// -0 (just so we don't lose that information when parsing and reconstructing)
// but can also default to +0 was extraordinary.

function parseTimezoneOffset(offset) {
	let [, sign, hours, minutes] = offset.match(/(\+|-)(\d\d)(\d\d)/);
	minutes = (sign === '+' ? 1 : -1) * (Number(hours) * 60 + Number(minutes));
	return negateExceptForZeroForParse(minutes);
}

function negateExceptForZeroForParse(n) {
	return n === 0 ? n : -n;
}

// webpack://git/./src/models/GitCommit.js
export class GitCommit {
	constructor(commit) {
		if (typeof commit === 'string') {
			this._commit = commit;
		} else if (Buffer.isBuffer(commit)) {
			this._commit = commit.toString('utf8');
		} else if (typeof commit === 'object') {
			this._commit = GitCommit.render(commit);
		} else {
			throw new InternalError(
				'invalid type passed to GitCommit constructor'
			);
		}
	}

	static fromPayloadSignature({ payload, signature }) {
		const headers = GitCommit.justHeaders(payload);
		const message = GitCommit.justMessage(payload);
		const commit = normalizeNewlines(
			headers + '\ngpgsig' + indent(signature) + '\n' + message
		);
		return new GitCommit(commit);
	}

	static from(commit) {
		return new GitCommit(commit);
	}

	toObject() {
		return Buffer.from(this._commit, 'utf8');
	}

	// Todo: allow setting the headers and message
	headers() {
		return this.parseHeaders();
	}

	// Todo: allow setting the headers and message
	message() {
		return GitCommit.justMessage(this._commit);
	}

	parse() {
		return Object.assign({ message: this.message() }, this.headers());
	}

	static justMessage(commit) {
		return normalizeNewlines(commit.slice(commit.indexOf('\n\n') + 2));
	}

	static justHeaders(commit) {
		return commit.slice(0, commit.indexOf('\n\n'));
	}

	parseHeaders() {
		const headers = GitCommit.justHeaders(this._commit).split('\n');
		const hs = [];
		for (const h of headers) {
			if (h[0] === ' ') {
				// combine with previous header (without space indent)
				hs[hs.length - 1] += '\n' + h.slice(1);
			} else {
				hs.push(h);
			}
		}
		const obj = {
			parent: [],
		};
		for (const h of hs) {
			const key = h.slice(0, h.indexOf(' '));
			const value = h.slice(h.indexOf(' ') + 1);
			if (Array.isArray(obj[key])) {
				obj[key].push(value);
			} else {
				obj[key] = value;
			}
		}
		if (obj.author) {
			obj.author = parseAuthor(obj.author);
		}
		if (obj.committer) {
			obj.committer = parseAuthor(obj.committer);
		}
		return obj;
	}

	static renderHeaders(obj) {
		let headers = '';
		if (obj.tree) {
			headers += `tree ${obj.tree}\n`;
		} else {
			headers += `tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\n`; // the null tree
		}
		if (obj.parent) {
			if (obj.parent.length === undefined) {
				throw new InternalError(
					`commit 'parent' property should be an array`
				);
			}
			for (const p of obj.parent) {
				headers += `parent ${p}\n`;
			}
		}
		const author = obj.author;
		headers += `author ${formatAuthor(author)}\n`;
		const committer = obj.committer || obj.author;
		headers += `committer ${formatAuthor(committer)}\n`;
		if (obj.gpgsig) {
			headers += 'gpgsig' + indent(obj.gpgsig);
		}
		return headers;
	}

	static render(obj) {
		return (
			GitCommit.renderHeaders(obj) + '\n' + normalizeNewlines(obj.message)
		);
	}

	render() {
		return this._commit;
	}

	withoutSignature() {
		const commit = normalizeNewlines(this._commit);
		if (commit.indexOf('\ngpgsig') === -1) return commit;
		const headers = commit.slice(0, commit.indexOf('\ngpgsig'));
		const message = commit.slice(
			commit.indexOf('-----END PGP SIGNATURE-----\n') +
				'-----END PGP SIGNATURE-----\n'.length
		);
		return normalizeNewlines(headers + '\n' + message);
	}

	isolateSignature() {
		const signature = this._commit.slice(
			this._commit.indexOf('-----BEGIN PGP SIGNATURE-----'),
			this._commit.indexOf('-----END PGP SIGNATURE-----') +
				'-----END PGP SIGNATURE-----'.length
		);
		return outdent(signature);
	}

	static async sign(commit, sign, secretKey) {
		const payload = commit.withoutSignature();
		const message = GitCommit.justMessage(commit._commit);
		let { signature } = await sign({ payload, secretKey });
		// renormalize the line endings to the one true line-ending
		signature = normalizeNewlines(signature);
		const headers = GitCommit.justHeaders(commit._commit);
		const signedCommit =
			headers + '\n' + 'gpgsig' + indent(signature) + '\n' + message;
		// return a new commit object
		return GitCommit.from(signedCommit);
	}
}

// webpack://git/./src/models/GitAnnotatedTag.js
export class GitAnnotatedTag {
	constructor(tag) {
		if (typeof tag === 'string') {
			this._tag = tag;
		} else if (Buffer.isBuffer(tag)) {
			this._tag = tag.toString('utf8');
		} else if (typeof tag === 'object') {
			this._tag = GitAnnotatedTag.render(tag);
		} else {
			throw new InternalError(
				'invalid type passed to GitAnnotatedTag constructor'
			);
		}
	}

	static from(tag) {
		return new GitAnnotatedTag(tag);
	}

	static render(obj) {
		return `object ${obj.object}
type ${obj.type}
tag ${obj.tag}
tagger ${formatAuthor(obj.tagger)}

${obj.message}
${obj.gpgsig ? obj.gpgsig : ''}`;
	}

	justHeaders() {
		return this._tag.slice(0, this._tag.indexOf('\n\n'));
	}

	message() {
		const tag = this.withoutSignature();
		return tag.slice(tag.indexOf('\n\n') + 2);
	}

	parse() {
		return Object.assign(this.headers(), {
			message: this.message(),
			gpgsig: this.gpgsig(),
		});
	}

	render() {
		return this._tag;
	}

	headers() {
		const headers = this.justHeaders().split('\n');
		const hs = [];
		for (const h of headers) {
			if (h[0] === ' ') {
				// combine with previous header (without space indent)
				hs[hs.length - 1] += '\n' + h.slice(1);
			} else {
				hs.push(h);
			}
		}
		const obj = {};
		for (const h of hs) {
			const key = h.slice(0, h.indexOf(' '));
			const value = h.slice(h.indexOf(' ') + 1);
			if (Array.isArray(obj[key])) {
				obj[key].push(value);
			} else {
				obj[key] = value;
			}
		}
		if (obj.tagger) {
			obj.tagger = parseAuthor(obj.tagger);
		}
		if (obj.committer) {
			obj.committer = parseAuthor(obj.committer);
		}
		return obj;
	}

	withoutSignature() {
		const tag = normalizeNewlines(this._tag);
		if (tag.indexOf('\n-----BEGIN PGP SIGNATURE-----') === -1) return tag;
		return tag.slice(0, tag.lastIndexOf('\n-----BEGIN PGP SIGNATURE-----'));
	}

	gpgsig() {
		if (this._tag.indexOf('\n-----BEGIN PGP SIGNATURE-----') === -1) return;
		const signature = this._tag.slice(
			this._tag.indexOf('-----BEGIN PGP SIGNATURE-----'),
			this._tag.indexOf('-----END PGP SIGNATURE-----') +
				'-----END PGP SIGNATURE-----'.length
		);
		return normalizeNewlines(signature);
	}

	payload() {
		return this.withoutSignature() + '\n';
	}

	toObject() {
		return Buffer.from(this._tag, 'utf8');
	}

	static async sign(tag, sign, secretKey) {
		const payload = tag.payload();
		let { signature } = await sign({ payload, secretKey });
		// renormalize the line endings to the one true line-ending
		signature = normalizeNewlines(signature);
		const signedTag = payload + signature;
		// return a new tag object
		return GitAnnotatedTag.from(signedTag);
	}
}

// webpack://git/./src/models/GitObject.js
/**
 * Represents a Git object and provides methods to wrap and unwrap Git objects
 * according to the Git object format.
 */
export class GitObject {
	/**
	 * Wraps a raw object with a Git header.
	 *
	 * @param {Object} params - The parameters for wrapping.
	 * @param {string} params.type - The type of the Git object (e.g., 'blob', 'tree', 'commit').
	 * @param {Uint8Array} params.object - The raw object data to wrap.
	 * @returns {Uint8Array} The wrapped Git object as a single buffer.
	 */
	static wrap({ type, object }) {
		const header = `${type} ${object.length}\x00`;
		const headerLen = header.length;
		const totalLength = headerLen + object.length;

		// Allocate a single buffer for the header and object, rather than create multiple buffers
		const wrappedObject = new Uint8Array(totalLength);
		for (let i = 0; i < headerLen; i++) {
			wrappedObject[i] = header.charCodeAt(i);
		}
		wrappedObject.set(object, headerLen);

		return wrappedObject;
	}

	/**
	 * Unwraps a Git object buffer into its type and raw object data.
	 *
	 * @param {Buffer|Uint8Array} buffer - The buffer containing the wrapped Git object.
	 * @returns {{ type: string, object: Buffer }} An object containing the type and the raw object data.
	 * @throws {InternalError} If the length specified in the header does not match the actual object length.
	 */
	static unwrap(buffer) {
		const s = buffer.indexOf(32); // first space
		const i = buffer.indexOf(0); // first null value
		const type = buffer.slice(0, s).toString('utf8'); // get type of object
		const length = buffer.slice(s + 1, i).toString('utf8'); // get type of object
		const actualLength = buffer.length - (i + 1);
		// verify length
		if (parseInt(length) !== actualLength) {
			throw new InternalError(
				`Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
			);
		}
		return {
			type,
			object: Buffer.from(buffer.slice(i + 1)),
		};
	}
}

// webpack://git/./src/utils/BufferCursor.js
// Modeled after https://github.com/tjfontaine/node-buffercursor
// but with the goal of being much lighter weight.
export class BufferCursor {
	constructor(buffer) {
		this.buffer = buffer;
		this._start = 0;
	}

	eof() {
		return this._start >= this.buffer.length;
	}

	tell() {
		return this._start;
	}

	seek(n) {
		this._start = n;
	}

	slice(n) {
		const r = this.buffer.slice(this._start, this._start + n);
		this._start += n;
		return r;
	}

	toString(enc, length) {
		const r = this.buffer.toString(enc, this._start, this._start + length);
		this._start += length;
		return r;
	}

	write(value, length, enc) {
		const r = this.buffer.write(value, this._start, length, enc);
		this._start += length;
		return r;
	}

	copy(source, start, end) {
		const r = source.copy(this.buffer, this._start, start, end);
		this._start += r;
		return r;
	}

	readUInt8() {
		const r = this.buffer.readUInt8(this._start);
		this._start += 1;
		return r;
	}

	writeUInt8(value) {
		const r = this.buffer.writeUInt8(value, this._start);
		this._start += 1;
		return r;
	}

	readUInt16BE() {
		const r = this.buffer.readUInt16BE(this._start);
		this._start += 2;
		return r;
	}

	writeUInt16BE(value) {
		const r = this.buffer.writeUInt16BE(value, this._start);
		this._start += 2;
		return r;
	}

	readUInt32BE() {
		const r = this.buffer.readUInt32BE(this._start);
		this._start += 4;
		return r;
	}

	writeUInt32BE(value) {
		const r = this.buffer.writeUInt32BE(value, this._start);
		this._start += 4;
		return r;
	}
}

// webpack://git/./src/utils/applyDelta.js
/**
 * @param {Buffer} delta
 * @param {Buffer} source
 * @returns {Buffer}
 */
export function applyDelta(delta, source) {
	const reader = new BufferCursor(delta);
	const sourceSize = readVarIntLE(reader);

	if (sourceSize !== source.byteLength) {
		throw new InternalError(
			`applyDelta expected source buffer to be ${sourceSize} bytes but the provided buffer was ${source.length} bytes`
		);
	}
	const targetSize = readVarIntLE(reader);
	let target;

	const firstOp = readOp(reader, source);
	// Speed optimization - return raw buffer if it's just single simple copy
	if (firstOp.byteLength === targetSize) {
		target = firstOp;
	} else {
		// Otherwise, allocate a fresh buffer and slices
		target = Buffer.alloc(targetSize);
		const writer = new BufferCursor(target);
		writer.copy(firstOp);

		while (!reader.eof()) {
			writer.copy(readOp(reader, source));
		}

		const tell = writer.tell();
		if (targetSize !== tell) {
			throw new InternalError(
				`applyDelta expected target buffer to be ${targetSize} bytes but the resulting buffer was ${tell} bytes`
			);
		}
	}
	return target;
}

function readVarIntLE(reader) {
	let result = 0;
	let shift = 0;
	let byte = null;
	do {
		byte = reader.readUInt8();
		result |= (byte & 0b01111111) << shift;
		shift += 7;
	} while (byte & 0b10000000);
	return result;
}

function readCompactLE(reader, flags, size) {
	let result = 0;
	let shift = 0;
	while (size--) {
		if (flags & 0b00000001) {
			result |= reader.readUInt8() << shift;
		}
		flags >>= 1;
		shift += 8;
	}
	return result;
}

function readOp(reader, source) {
	/** @type {number} */
	const byte = reader.readUInt8();
	const COPY = 0b10000000;
	const OFFS = 0b00001111;
	const SIZE = 0b01110000;
	if (byte & COPY) {
		// copy consists of 4 byte offset, 3 byte size (in LE order)
		const offset = readCompactLE(reader, byte & OFFS, 4);
		let size = readCompactLE(reader, (byte & SIZE) >> 4, 3);
		// Yup. They really did this optimization.
		if (size === 0) size = 0x10000;
		return source.slice(offset, offset + size);
	} else {
		// insert
		return reader.slice(byte);
	}
}

// webpack://git/./src/utils/git-list-pack.js
// My version of git-list-pack - roughly 15x faster than the original
// It's used slightly differently - instead of returning a through stream it wraps a stream.
// (I tried to make it API identical, but that ended up being 2x slower than this version.)

export async function listpack(stream, onData) {
	const reader = new StreamReader(stream);
	let PACK = await reader.read(4);
	PACK = PACK.toString('utf8');
	if (PACK !== 'PACK') {
		throw new InternalError(`Invalid PACK header '${PACK}'`);
	}

	let version = await reader.read(4);
	version = version.readUInt32BE(0);
	if (version !== 2) {
		throw new InternalError(`Invalid packfile version: ${version}`);
	}

	let numObjects = await reader.read(4);
	numObjects = numObjects.readUInt32BE(0);
	// If (for some godforsaken reason) this is an empty packfile, abort now.
	if (numObjects < 1) return;

	while (!reader.eof() && numObjects--) {
		const offset = reader.tell();
		const { type, length, ofs, reference } = await parseHeader(reader);
		const inflator = new pako.Inflate();
		while (!inflator.result) {
			const chunk = await reader.chunk();
			if (!chunk) break;
			inflator.push(chunk, false);
			if (inflator.err) {
				throw new InternalError(`Pako error: ${inflator.msg}`);
			}
			if (inflator.result) {
				if (inflator.result.length !== length) {
					throw new InternalError(
						`Inflated object size is different from that stated in packfile.`
					);
				}

				// Backtrack parser to where deflated data ends
				await reader.undo();
				await reader.read(chunk.length - inflator.strm.avail_in);
				const end = reader.tell();
				await onData({
					data: inflator.result,
					type,
					num: numObjects,
					offset,
					end,
					reference,
					ofs,
				});
			}
		}
	}
}

async function parseHeader(reader) {
	// Object type is encoded in bits 654
	let byte = await reader.byte();
	const type = (byte >> 4) & 0b111;
	// The length encoding get complicated.
	// Last four bits of length is encoded in bits 3210
	let length = byte & 0b1111;
	// Whether the next byte is part of the variable-length encoded number
	// is encoded in bit 7
	if (byte & 0b10000000) {
		let shift = 4;
		do {
			byte = await reader.byte();
			length |= (byte & 0b01111111) << shift;
			shift += 7;
		} while (byte & 0b10000000);
	}
	// Handle deltified objects
	let ofs;
	let reference;
	if (type === 6) {
		let shift = 0;
		ofs = 0;
		const bytes = [];
		do {
			byte = await reader.byte();
			ofs |= (byte & 0b01111111) << shift;
			shift += 7;
			bytes.push(byte);
		} while (byte & 0b10000000);
		reference = Buffer.from(bytes);
	}
	if (type === 7) {
		const buf = await reader.read(20);
		reference = buf;
	}
	return { type, length, ofs, reference };
}

// webpack://git/./src/utils/inflate.js
/* eslint-env node, browser */
/* global DecompressionStream */

let supportsDecompressionStream = false;

export async function inflate(buffer) {
	if (supportsDecompressionStream === null) {
		supportsDecompressionStream = testDecompressionStream();
	}
	return supportsDecompressionStream
		? browserInflate(buffer)
		: pako.inflate(buffer);
}

async function browserInflate(buffer) {
	const ds = new DecompressionStream('deflate');
	const d = new Blob([buffer]).stream().pipeThrough(ds);
	return new Uint8Array(await new Response(d).arrayBuffer());
}

function testDecompressionStream() {
	try {
		const ds = new DecompressionStream('deflate');
		if (ds) return true;
	} catch (_) {
		// no bother
	}
	return false;
}

// webpack://git/./src/utils/toHex.js
export function toHex(buffer) {
	let hex = '';
	for (const byte of new Uint8Array(buffer)) {
		if (byte < 16) hex += '0';
		hex += byte.toString(16);
	}
	return hex;
}

// webpack://git/./src/utils/shasum.js
/* eslint-env node, browser */

let supportsSubtleSHA1 = null;

export async function shasum(buffer) {
	if (supportsSubtleSHA1 === null) {
		supportsSubtleSHA1 = await testSubtleSHA1();
	}
	return supportsSubtleSHA1 ? subtleSHA1(buffer) : shasumSync(buffer);
}

// This is modeled after @dominictarr's "shasum" module,
// but without the 'json-stable-stringify' dependency and
// extra type-casting features.
function shasumSync(buffer) {
	return new Hash().update(buffer).digest('hex');
}

async function subtleSHA1(buffer) {
	const hash = await crypto.subtle.digest('SHA-1', buffer);
	return toHex(hash);
}

async function testSubtleSHA1() {
	// I'm using a rather crude method of progressive enhancement, because
	// some browsers that have crypto.subtle.digest don't actually implement SHA-1.
	try {
		const hash = await subtleSHA1(new Uint8Array([]));
		return hash === 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
	} catch (_) {
		// no bother
	}
	return false;
}

// webpack://git/./src/models/GitPackIndex.js
function decodeVarInt(reader) {
	const bytes = [];
	let byte = 0;
	let multibyte = 0;
	do {
		byte = reader.readUInt8();
		// We keep bits 6543210
		const lastSeven = byte & 0b01111111;
		bytes.push(lastSeven);
		// Whether the next byte is part of the variable-length encoded number
		// is encoded in bit 7
		multibyte = byte & 0b10000000;
	} while (multibyte);
	// Now that all the bytes are in big-endian order,
	// alternate shifting the bits left by 7 and OR-ing the next byte.
	// And... do a weird increment-by-one thing that I don't quite understand.
	return bytes.reduce((a, b) => ((a + 1) << 7) | b, -1);
}

// I'm pretty much copying this one from the git C source code,
// because it makes no sense.
function otherVarIntDecode(reader, startWith) {
	let result = startWith;
	let shift = 4;
	let byte = null;
	do {
		byte = reader.readUInt8();
		result |= (byte & 0b01111111) << shift;
		shift += 7;
	} while (byte & 0b10000000);
	return result;
}

export class GitPackIndex {
	constructor(stuff) {
		Object.assign(this, stuff);
		this.offsetCache = {};
	}

	static async fromIdx({ idx, getExternalRefDelta }) {
		const reader = new BufferCursor(idx);
		const magic = reader.slice(4).toString('hex');
		// Check for IDX v2 magic number
		if (magic !== 'ff744f63') {
			return; // undefined
		}
		const version = reader.readUInt32BE();
		if (version !== 2) {
			throw new InternalError(
				`Unable to read version ${version} packfile IDX. (Only version 2 supported)`
			);
		}
		if (idx.byteLength > 2048 * 1024 * 1024) {
			throw new InternalError(
				`To keep implementation simple, I haven't implemented the layer 5 feature needed to support packfiles > 2GB in size.`
			);
		}
		// Skip over fanout table
		reader.seek(reader.tell() + 4 * 255);
		// Get hashes
		const size = reader.readUInt32BE();
		const hashes = [];
		for (let i = 0; i < size; i++) {
			const hash = reader.slice(20).toString('hex');
			hashes[i] = hash;
		}
		reader.seek(reader.tell() + 4 * size);
		// Skip over CRCs
		// Get offsets
		const offsets = new Map();
		for (let i = 0; i < size; i++) {
			offsets.set(hashes[i], reader.readUInt32BE());
		}
		const packfileSha = reader.slice(20).toString('hex');
		return new GitPackIndex({
			hashes,
			crcs: {},
			offsets,
			packfileSha,
			getExternalRefDelta,
		});
	}

	static async fromPack({ pack, getExternalRefDelta, onProgress }) {
		const listpackTypes = {
			1: 'commit',
			2: 'tree',
			3: 'blob',
			4: 'tag',
			6: 'ofs-delta',
			7: 'ref-delta',
		};
		const offsetToObject = {};

		// Older packfiles do NOT use the shasum of the pack itself,
		// so it is recommended to just use whatever bytes are in the trailer.
		// Source: https://github.com/git/git/commit/1190a1acf800acdcfd7569f87ac1560e2d077414
		const packfileSha = pack.slice(-20).toString('hex');

		const hashes = [];
		const crcs = {};
		const offsets = new Map();
		let totalObjectCount = null;
		let lastPercent = null;

		await listpack(
			[pack],
			async ({ data, type, reference, offset, num }) => {
				if (totalObjectCount === null) totalObjectCount = num;
				const percent = Math.floor(
					((totalObjectCount - num) * 100) / totalObjectCount
				);
				if (percent !== lastPercent) {
					if (onProgress) {
						await onProgress({
							phase: 'Receiving objects',
							loaded: totalObjectCount - num,
							total: totalObjectCount,
						});
					}
				}
				lastPercent = percent;
				// Change type from a number to a meaningful string
				type = listpackTypes[type];

				if (['commit', 'tree', 'blob', 'tag'].includes(type)) {
					offsetToObject[offset] = {
						type,
						offset,
					};
				} else if (type === 'ofs-delta') {
					offsetToObject[offset] = {
						type,
						offset,
					};
				} else if (type === 'ref-delta') {
					offsetToObject[offset] = {
						type,
						offset,
					};
				}
			}
		);

		// We need to know the lengths of the slices to compute the CRCs.
		const offsetArray = Object.keys(offsetToObject).map(Number);
		for (const [i, start] of offsetArray.entries()) {
			const end =
				i + 1 === offsetArray.length
					? pack.byteLength - 20
					: offsetArray[i + 1];
			const o = offsetToObject[start];
			const crc = crc32.buf(pack.slice(start, end)) >>> 0;
			o.end = end;
			o.crc = crc;
		}

		// We don't have the hashes yet. But we can generate them using the .readSlice function!
		const p = new GitPackIndex({
			pack: Promise.resolve(pack),
			packfileSha,
			crcs,
			hashes,
			offsets,
			getExternalRefDelta,
		});

		// Resolve deltas and compute the oids
		lastPercent = null;
		let count = 0;
		const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		for (let offset in offsetToObject) {
			offset = Number(offset);
			const percent = Math.floor((count * 100) / totalObjectCount);
			if (percent !== lastPercent) {
				if (onProgress) {
					await onProgress({
						phase: 'Resolving deltas',
						loaded: count,
						total: totalObjectCount,
					});
				}
			}
			count++;
			lastPercent = percent;

			const o = offsetToObject[offset];
			if (o.oid) continue;
			try {
				p.readDepth = 0;
				p.externalReadDepth = 0;
				const { type, object } = await p.readSlice({ start: offset });
				objectsByDepth[p.readDepth] += 1;
				const oid = await shasum(GitObject.wrap({ type, object }));
				o.oid = oid;
				hashes.push(oid);
				offsets.set(oid, offset);
				crcs[oid] = o.crc;
			} catch (err) {
				continue;
			}
		}

		hashes.sort();
		return p;
	}

	async toBuffer() {
		const buffers = [];
		const write = (str, encoding) => {
			buffers.push(Buffer.from(str, encoding));
		};
		// Write out IDX v2 magic number
		write('ff744f63', 'hex');
		// Write out version number 2
		write('00000002', 'hex');
		// Write fanout table
		const fanoutBuffer = new BufferCursor(Buffer.alloc(256 * 4));
		for (let i = 0; i < 256; i++) {
			let count = 0;
			for (const hash of this.hashes) {
				if (parseInt(hash.slice(0, 2), 16) <= i) count++;
			}
			fanoutBuffer.writeUInt32BE(count);
		}
		buffers.push(fanoutBuffer.buffer);
		// Write out hashes
		for (const hash of this.hashes) {
			write(hash, 'hex');
		}
		// Write out crcs
		const crcsBuffer = new BufferCursor(
			Buffer.alloc(this.hashes.length * 4)
		);
		for (const hash of this.hashes) {
			crcsBuffer.writeUInt32BE(this.crcs[hash]);
		}
		buffers.push(crcsBuffer.buffer);
		// Write out offsets
		const offsetsBuffer = new BufferCursor(
			Buffer.alloc(this.hashes.length * 4)
		);
		for (const hash of this.hashes) {
			offsetsBuffer.writeUInt32BE(this.offsets.get(hash));
		}
		buffers.push(offsetsBuffer.buffer);
		// Write out packfile checksum
		write(this.packfileSha, 'hex');
		// Write out shasum
		const totalBuffer = Buffer.concat(buffers);
		const sha = await shasum(totalBuffer);
		const shaBuffer = Buffer.alloc(20);
		shaBuffer.write(sha, 'hex');
		return Buffer.concat([totalBuffer, shaBuffer]);
	}

	async load({ pack }) {
		this.pack = pack;
	}

	async unload() {
		this.pack = null;
	}

	async read({ oid }) {
		if (!this.offsets.get(oid)) {
			if (this.getExternalRefDelta) {
				this.externalReadDepth++;
				return this.getExternalRefDelta(oid);
			} else {
				throw new InternalError(
					`Could not read object ${oid} from packfile`
				);
			}
		}
		const start = this.offsets.get(oid);
		return this.readSlice({ start });
	}

	async readSlice({ start }) {
		if (this.offsetCache[start]) {
			return Object.assign({}, this.offsetCache[start]);
		}
		this.readDepth++;
		const types = {
			0b0010000: 'commit',
			0b0100000: 'tree',
			0b0110000: 'blob',
			0b1000000: 'tag',
			0b1100000: 'ofs_delta',
			0b1110000: 'ref_delta',
		};
		const pack = await this.pack;
		if (!pack) {
			throw new InternalError(
				'Could not read packfile data. The packfile may be missing, corrupted, or too large to read into memory.'
			);
		}
		const raw = pack.slice(start);
		const reader = new BufferCursor(raw);
		const byte = reader.readUInt8();
		// Object type is encoded in bits 654
		const btype = byte & 0b1110000;
		let type = types[btype];
		if (type === undefined) {
			throw new InternalError(
				'Unrecognized type: 0b' + btype.toString(2)
			);
		}
		// The length encoding get complicated.
		// Last four bits of length is encoded in bits 3210
		const lastFour = byte & 0b1111;
		let length = lastFour;
		// Whether the next byte is part of the variable-length encoded number
		// is encoded in bit 7
		const multibyte = byte & 0b10000000;
		if (multibyte) {
			length = otherVarIntDecode(reader, lastFour);
		}
		let base = null;
		let object = null;
		// Handle deltified objects
		if (type === 'ofs_delta') {
			const offset = decodeVarInt(reader);
			const baseOffset = start - offset;
			({ object: base, type } = await this.readSlice({
				start: baseOffset,
			}));
		}
		if (type === 'ref_delta') {
			const oid = reader.slice(20).toString('hex');
			({ object: base, type } = await this.read({ oid }));
		}
		// Handle undeltified objects
		const buffer = raw.slice(reader.tell());
		object = Buffer.from(await inflate(buffer));
		// Assert that the object length is as expected.
		if (object.byteLength !== length) {
			throw new InternalError(
				`Packfile told us object would have length ${length} but it had length ${object.byteLength}`
			);
		}
		if (base) {
			object = Buffer.from(applyDelta(object, base));
		}
		// Cache the result based on depth.
		if (this.readDepth > 3) {
			// hand tuned for speed / memory usage tradeoff
			this.offsetCache[start] = { type, object };
		}
		return { type, format: 'content', object };
	}
}

// webpack://git/./src/errors/InvalidOidError.js
export class InvalidOidError extends BaseError {
	/**
	 * @param {string} value
	 */
	constructor(value) {
		super(`Expected a 40-char hex object id but saw "${value}".`);
		this.code = this.name = InvalidOidError.code;
		this.data = { value };
	}
}
/** @type {'InvalidOidError'} */
InvalidOidError.code = 'InvalidOidError';

// webpack://git/./src/utils/FIFO.js
export class FIFO {
	constructor() {
		this._queue = [];
	}

	write(chunk) {
		if (this._ended) {
			throw Error(
				'You cannot write to a FIFO that has already been ended!'
			);
		}
		if (this._waiting) {
			const resolve = this._waiting;
			this._waiting = null;
			resolve({ value: chunk });
		} else {
			this._queue.push(chunk);
		}
	}

	end() {
		this._ended = true;
		if (this._waiting) {
			const resolve = this._waiting;
			this._waiting = null;
			resolve({ done: true });
		}
	}

	destroy(err) {
		this.error = err;
		this.end();
	}

	async next() {
		if (this._queue.length > 0) {
			return { value: this._queue.shift() };
		}
		if (this._ended) {
			return { done: true };
		}
		if (this._waiting) {
			throw Error(
				'You cannot call read until the previous call to read has returned!'
			);
		}
		return new Promise((resolve) => {
			this._waiting = resolve;
		});
	}
}

// webpack://git/./src/models/GitSideBand.js
/*
If 'side-band' or 'side-band-64k' capabilities have been specified by
the client, the server will send the packfile data multiplexed.

Each packet starting with the packet-line length of the amount of data
that follows, followed by a single byte specifying the sideband the
following data is coming in on.

In 'side-band' mode, it will send up to 999 data bytes plus 1 control
code, for a total of up to 1000 bytes in a pkt-line.  In 'side-band-64k'
mode it will send up to 65519 data bytes plus 1 control code, for a
total of up to 65520 bytes in a pkt-line.

The sideband byte will be a '1', '2' or a '3'. Sideband '1' will contain
packfile data, sideband '2' will be used for progress information that the
client will generally print to stderr and sideband '3' is used for error
information.

If no 'side-band' capability was specified, the server will stream the
entire packfile without multiplexing.
*/

export class GitSideBand {
	static demux(input) {
		const read = GitPktLine.streamReader(input);
		// And now for the ridiculous side-band or side-band-64k protocol
		const packetlines = new FIFO();
		const packfile = new FIFO();
		const progress = new FIFO();
		// TODO: Use a proper through stream?
		const nextBit = async function () {
			const line = await read();
			// Skip over flush packets
			if (line === null) return nextBit();
			// A made up convention to signal there's no more to read.
			if (line === true) {
				packetlines.end();
				progress.end();
				input.error ? packfile.destroy(input.error) : packfile.end();
				return;
			}
			// Examine first byte to determine which output "stream" to use
			switch (line[0]) {
				case 1: {
					// pack data
					packfile.write(line.slice(1));
					break;
				}
				case 2: {
					// progress message
					progress.write(line.slice(1));
					break;
				}
				case 3: {
					// fatal error message just before stream aborts
					const error = line.slice(1);
					progress.write(error);
					packetlines.end();
					progress.end();
					packfile.destroy(new Error(error.toString('utf8')));
					return;
				}
				default: {
					// Not part of the side-band-64k protocol
					packetlines.write(line);
				}
			}
			// Careful not to blow up the stack.
			// I think Promises in a tail-call position should be OK.
			nextBit();
		};
		nextBit();
		return {
			packetlines,
			packfile,
			progress,
		};
	}
	// static mux ({
	//   protocol, // 'side-band' or 'side-band-64k'
	//   packetlines,
	//   packfile,
	//   progress,
	//   error
	// }) {
	//   const MAX_PACKET_LENGTH = protocol === 'side-band-64k' ? 999 : 65519
	//   let output = new PassThrough()
	//   packetlines.on('data', data => {
	//     if (data === null) {
	//       output.write(GitPktLine.flush())
	//     } else {
	//       output.write(GitPktLine.encode(data))
	//     }
	//   })
	//   let packfileWasEmpty = true
	//   let packfileEnded = false
	//   let progressEnded = false
	//   let errorEnded = false
	//   let goodbye = Buffer.concat([
	//     GitPktLine.encode(Buffer.from('010A', 'hex')),
	//     GitPktLine.flush()
	//   ])
	//   packfile
	//     .on('data', data => {
	//       packfileWasEmpty = false
	//       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
	//       for (const buffer of buffers) {
	//         output.write(
	//           GitPktLine.encode(Buffer.concat([Buffer.from('01', 'hex'), buffer]))
	//         )
	//       }
	//     })
	//     .on('end', () => {
	//       packfileEnded = true
	//       if (!packfileWasEmpty) output.write(goodbye)
	//       if (progressEnded && errorEnded) output.end()
	//     })
	//   progress
	//     .on('data', data => {
	//       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
	//       for (const buffer of buffers) {
	//         output.write(
	//           GitPktLine.encode(Buffer.concat([Buffer.from('02', 'hex'), buffer]))
	//         )
	//       }
	//     })
	//     .on('end', () => {
	//       progressEnded = true
	//       if (packfileEnded && errorEnded) output.end()
	//     })
	//   error
	//     .on('data', data => {
	//       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
	//       for (const buffer of buffers) {
	//         output.write(
	//           GitPktLine.encode(Buffer.concat([Buffer.from('03', 'hex'), buffer]))
	//         )
	//       }
	//     })
	//     .on('end', () => {
	//       errorEnded = true
	//       if (progressEnded && packfileEnded) output.end()
	//     })
	//   return output
	// }
}

// webpack://git/./src/utils/forAwait.js
// Currently 'for await' upsets my linters.
export async function forAwait(iterable, cb) {
	const iter = getIterator(iterable);
	while (true) {
		const { value, done } = await iter.next();
		if (value) await cb(value);
		if (done) break;
	}
	if (iter.return) iter.return();
}

// webpack://git/./src/wire/parseUploadPackResponse.js
export async function parseUploadPackResponse(stream) {
	const { packetlines, packfile, progress } = GitSideBand.demux(stream);
	const shallows = [];
	const unshallows = [];
	const acks = [];
	let nak = false;
	let done = false;
	return new Promise((resolve, reject) => {
		// Parse the response
		forAwait(packetlines, (data) => {
			const line = data.toString('utf8').trim();
			if (line.startsWith('shallow')) {
				const oid = line.slice(-41).trim();
				if (oid.length !== 40) {
					reject(new InvalidOidError(oid));
				}
				shallows.push(oid);
			} else if (line.startsWith('unshallow')) {
				const oid = line.slice(-41).trim();
				if (oid.length !== 40) {
					reject(new InvalidOidError(oid));
				}
				unshallows.push(oid);
			} else if (line.startsWith('ACK')) {
				const [, oid, status] = line.split(' ');
				acks.push({ oid, status });
				if (!status) done = true;
			} else if (line.startsWith('NAK')) {
				nak = true;
				done = true;
			} else {
				done = true;
				nak = true;
			}
			if (done) {
				stream.error
					? reject(stream.error)
					: resolve({
							shallows,
							unshallows,
							acks,
							nak,
							packfile,
							progress,
						});
			}
		}).finally(() => {
			if (!done) {
				stream.error
					? reject(stream.error)
					: resolve({
							shallows,
							unshallows,
							acks,
							nak,
							packfile,
							progress,
						});
			}
		});
	});
}

// webpack://git/./src/errors/ObjectTypeError.js
export class ObjectTypeError extends BaseError {
	/**
	 * @param {string} oid
	 * @param {'blob'|'commit'|'tag'|'tree'} actual
	 * @param {'blob'|'commit'|'tag'|'tree'} expected
	 * @param {string} [filepath]
	 */
	constructor(oid, actual, expected, filepath) {
		super(
			`Object ${oid} ${
				filepath ? `at ${filepath}` : ''
			}was anticipated to be a ${expected} but it is a ${actual}.`
		);
		this.code = this.name = ObjectTypeError.code;
		this.data = { oid, actual, expected, filepath };
	}
}
/** @type {'ObjectTypeError'} */
ObjectTypeError.code = 'ObjectTypeError';

// webpack://git/./src/utils/collect.js
export async function collect(iterable) {
	let size = 0;
	const buffers = [];
	// This will be easier once `for await ... of` loops are available.
	await forAwait(iterable, (value) => {
		buffers.push(value);
		size += value.byteLength;
	});
	const result = new Uint8Array(size);
	let nextIndex = 0;
	for (const buffer of buffers) {
		result.set(buffer, nextIndex);
		nextIndex += buffer.byteLength;
	}
	return result;
}
