/**
 * <php-snippet> — a runnable, syntax-highlighted PHP code embed.
 *
 * Drop this on any page:
 *
 *   <script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>
 *
 *   <php-snippet name="lazy-load-images.php">
 *     <script type="application/x-php">
 * <?php
 * $html = '<img src="hero.jpg">';
 * $tags = new WP_HTML_Tag_Processor( $html );
 * while ( $tags->next_tag( 'img' ) ) {
 *     $tags->set_attribute( 'loading', 'lazy' );
 * }
 * echo $tags->get_updated_html();
 *     </script>
 *   </php-snippet>
 *
 * Multiple <php-snippet> elements on the same page share a single hidden
 * Playground runtime that's only booted on the first Run click. PHP and
 * WordPress WASM are downloaded once per page, not once per snippet.
 *
 * Attributes:
 *   name="…"              filename label shown in the header
 *   php="8.4"             PHP version (default: 8.4)
 *   wp="latest"           WordPress version (default: latest). Use wp="none"
 *                         to boot PHP without installing WordPress — handy for
 *                         pure-PHP snippets that don't touch wp-load.php.
 *   src="path/to.php"     load code from a URL instead of inline
 *   runnable="false"      hide the Run button and render the snippet as a
 *                         read-only, syntax-highlighted code block. Useful for
 *                         illustrative examples that aren't meant to execute.
 *   readonly              render runnable snippets as read-only code blocks.
 *                         Snippets are editable by default, and Run executes
 *                         whatever the reader typed.
 *   editable              legacy opt-in for editable snippets. Since editing
 *                         is now the default, this is only needed for older
 *                         embeds. Set readonly or editable="false" to disable
 *                         editing.
 *   blueprint="toolkit"  CSS-selector-or-id of a JSON Blueprint container
 *                         on the page (a <script type="application/json"> is
 *                         recommended; <template> works too). Snippets that
 *                         share the same blueprint share one runtime — the
 *                         blueprint is JSON-stringified and folded into the
 *                         cache key.
 *   playground-origin="https://playground.wordpress.net"
 *                         override the runtime origin (useful for local dev)
 */

const DEFAULT_ORIGIN = 'https://playground.wordpress.net';
const DEFAULT_PHP = '8.4';
const DEFAULT_WP = 'latest';
const DOCS_URL =
	'https://wordpress.github.io/wordpress-playground/guides/php-code-snippets/';
const PLAYGROUND_URL = 'https://wordpress.org/playground/';

/**
 * Minimal duck-typed port of @php-wasm/progress's ProgressTracker.
 * The published playground.wordpress.net/client bundle uses this shape
 * internally (calls .stage(weight), .set(0–100), .setCaption(s), .finish(),
 * .pipe(receiver), .loadingListener) but does not export the class. Once
 * it is exported, this can be replaced with a direct import.
 */
const PROGRESS_EPSILON = 0.00001;
class ProgressTracker extends EventTarget {
	constructor({ weight = 1, caption = '' } = {}) {
		super();
		this._weight = weight;
		this._selfWeight = 1;
		this._selfProgress = 0;
		this._selfCaption = caption;
		this._selfDone = false;
		this._subs = [];
	}
	get weight() {
		return this._weight;
	}
	get progress() {
		if (this._selfDone) return 100;
		const sum = this._subs.reduce(
			(s, t) => s + t.progress * t.weight,
			this._selfProgress * this._selfWeight
		);
		return Math.round(sum * 10000) / 10000;
	}
	get done() {
		return this.progress + PROGRESS_EPSILON >= 100;
	}
	get caption() {
		for (let i = this._subs.length - 1; i >= 0; i--) {
			if (!this._subs[i].done && this._subs[i].caption) {
				return this._subs[i].caption;
			}
		}
		return this._selfCaption;
	}
	stage(weight, caption = '') {
		if (!weight) weight = this._selfWeight;
		this._selfWeight -= weight;
		const sub = new ProgressTracker({ weight, caption });
		this._subs.push(sub);
		sub.addEventListener('progress', () => this._notify());
		sub.addEventListener('done', () => {
			if (this.done) this._notifyDone();
		});
		return sub;
	}
	set(value) {
		this._selfProgress = Math.min(value, 100);
		this._notify();
		if (this._selfProgress + PROGRESS_EPSILON >= 100) this.finish();
	}
	setCaption(c) {
		this._selfCaption = c;
		this._notify();
	}
	finish() {
		if (this._fillInterval) {
			clearInterval(this._fillInterval);
			this._fillInterval = null;
		}
		this._isFilling = false;
		this._selfDone = true;
		this._selfProgress = 100;
		this._notify();
		this._notifyDone();
	}
	fillSlowly({ stopBeforeFinishing = true } = {}) {
		if (this._isFilling) return;
		this._isFilling = true;
		this._fillInterval = setInterval(() => {
			this.set(this._selfProgress + 1);
			if (stopBeforeFinishing && this._selfProgress >= 99) {
				clearInterval(this._fillInterval);
				this._fillInterval = null;
			}
		}, 40);
	}
	pipe(receiver) {
		receiver.setProgress({
			progress: this.progress,
			caption: this.caption,
		});
		this.addEventListener('progress', (e) =>
			receiver.setProgress({
				progress: e.detail.progress,
				caption: e.detail.caption,
			})
		);
		this.addEventListener('done', () => receiver.setLoaded());
	}
	get loadingListener() {
		if (!this._ll) {
			this._ll = (event) =>
				this.set((event.detail.loaded / event.detail.total) * 100);
		}
		return this._ll;
	}
	_notify() {
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					progress: this.progress,
					caption: this.caption,
				},
			})
		);
	}
	_notifyDone() {
		this.dispatchEvent(new CustomEvent('done'));
	}
}

/**
 * Each unique {origin, php, wp} combination boots its own runtime. Entries
 * live for the page lifetime so subsequent runs reuse the same client.
 * Per-entry subscribers means progress events from one boot never leak to
 * snippets waiting on a different runtime.
 */
const runtimes = new Map();

async function getSharedClient(
	{ origin, php, wp, blueprint, blueprintKey },
	onProgress
) {
	const key = `${origin}|${php}|${wp}|${blueprintKey}`;
	let entry = runtimes.get(key);

	if (entry && entry.client) {
		return entry.client;
	}

	if (!entry) {
		const tracker = new ProgressTracker();
		const subscribers = new Set();
		tracker.addEventListener('progress', (e) => {
			for (const fn of subscribers) {
				fn({
					progress: e.detail.progress,
					caption: e.detail.caption,
				});
			}
		});
		entry = { tracker, subscribers, client: null, promise: null };
		entry.promise = bootRuntime(
			{ origin, php, wp, blueprint },
			entry
		).catch((err) => {
			// Drop the failed entry so a future Run can retry from scratch
			// instead of forever awaiting the same rejected promise.
			runtimes.delete(key);
			throw err;
		});
		runtimes.set(key, entry);
		onProgress?.({ progress: 0, caption: 'Loading runtime…' });
	} else {
		// Boot in flight — replay the latest progress so a late-arriving
		// snippet shows the same bar position.
		onProgress?.({
			progress: entry.tracker.progress,
			caption: entry.tracker.caption,
		});
	}

	if (onProgress) entry.subscribers.add(onProgress);
	try {
		return await entry.promise;
	} finally {
		if (onProgress) entry.subscribers.delete(onProgress);
	}
}

async function bootRuntime({ origin, php, wp, blueprint }, entry) {
	const { startPlaygroundWeb } = await import(
		/* @vite-ignore */ `${origin}/client/index.js`
	);
	const iframe = document.createElement('iframe');
	iframe.title = 'PHP Snippet runtime';
	iframe.setAttribute('aria-hidden', 'true');
	iframe.style.cssText =
		'position:absolute;width:1px;height:1px;border:0;opacity:0;left:-9999px;';
	iframe.src = `${origin}/remote.html`;
	document.body.appendChild(iframe);
	// wp="none" maps to the Blueprint's declarative
	// `preferredVersions.wp: false`, which skips the WordPress download
	// entirely.
	const skipWordPress = wp === 'none';
	const client = await startPlaygroundWeb({
		iframe,
		remoteUrl: iframe.src,
		progressTracker: entry.tracker,
		blueprint: {
			...(blueprint || {}),
			preferredVersions: {
				php,
				wp: skipWordPress ? false : wp,
			},
		},
	});
	await client.isReady;
	entry.client = client;
	return client;
}

/**
 * Resolve a snippet's `blueprint` attribute to a Blueprint object.
 *
 * The lookup tries in order: a CSS selector, then `getElementById`, then
 * (if neither matched) returns null. The element is expected to be a
 * <template> whose textContent is a JSON Blueprint. The text is parsed
 * once per snippet but the resulting cache key collapses identical
 * blueprints into a single runtime boot.
 */
function resolveSetupBlueprint(snippet) {
	const ref = snippet.getAttribute('blueprint');
	if (!ref) return { blueprint: null, key: '' };
	let el = null;
	try {
		el = snippet.ownerDocument.querySelector(ref);
	} catch {
		// Invalid selector — fall through to getElementById.
	}
	if (!el) el = snippet.ownerDocument.getElementById(ref);
	if (!el) {
		throw new Error(
			`<php-snippet blueprint="${ref}"> could not find a matching element on the page.`
		);
	}
	const source =
		el.tagName === 'TEMPLATE' ? el.content.textContent : el.textContent;
	const text = (source || '').trim();
	if (!text) return { blueprint: null, key: '' };
	let blueprint;
	try {
		blueprint = JSON.parse(text);
	} catch (err) {
		throw new Error(
			`<php-snippet blueprint="${ref}"> contains invalid JSON: ${err.message}`
		);
	}
	// Stable stringification — the JSON object's textual form is the cache
	// key suffix. Two snippets that point at the same <template> end up with
	// the same string, hence the same key, hence one shared runtime.
	return { blueprint, key: stableStringify(blueprint) };
}

function stableStringify(value) {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return '[' + value.map(stableStringify).join(',') + ']';
	}
	const keys = Object.keys(value).sort();
	return (
		'{' +
		keys
			.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
			.join(',') +
		'}'
	);
}

/**
 * Tiny regex-based PHP highlighter (~80 lines). Good enough for typical
 * snippets without pulling in a 50KB tokenizer. The order matters: longer
 * patterns and string/comment patterns must come before keyword/identifier
 * patterns so they match first.
 */
const PHP_KEYWORDS = new Set([
	'abstract',
	'and',
	'array',
	'as',
	'break',
	'callable',
	'case',
	'catch',
	'class',
	'clone',
	'const',
	'continue',
	'declare',
	'default',
	'do',
	'echo',
	'else',
	'elseif',
	'empty',
	'enddeclare',
	'endfor',
	'endforeach',
	'endif',
	'endswitch',
	'endwhile',
	'extends',
	'final',
	'finally',
	'fn',
	'for',
	'foreach',
	'function',
	'global',
	'goto',
	'if',
	'implements',
	'include',
	'include_once',
	'instanceof',
	'insteadof',
	'interface',
	'isset',
	'list',
	'match',
	'namespace',
	'new',
	'null',
	'or',
	'print',
	'private',
	'protected',
	'public',
	'readonly',
	'require',
	'require_once',
	'return',
	'static',
	'switch',
	'throw',
	'trait',
	'try',
	'unset',
	'use',
	'var',
	'while',
	'xor',
	'yield',
	'true',
	'false',
]);

function escapeHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dedentLeading(s) {
	const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
	let min = Infinity;
	for (const line of lines) {
		if (!line.trim()) continue;
		const m = line.match(/^[ \t]*/);
		if (m && m[0].length < min) min = m[0].length;
	}
	if (!isFinite(min) || min === 0) return lines.join('\n');
	return lines.map((l) => l.slice(min)).join('\n');
}

function highlightPhp(code) {
	const tokens = [];
	let i = 0;
	const len = code.length;
	// Quoted string with backslash escapes (handles \", \', \\, \n, etc.).
	// Used for ', ", and ` (shell-exec). Returns the index past the closing
	// quote, or len if the string is unterminated.
	const scanQuoted = (start, quote) => {
		let j = start + 1;
		while (j < len && code[j] !== quote) {
			if (code[j] === '\\' && j + 1 < len) j++;
			j++;
		}
		return Math.min(j + 1, len);
	};
	while (i < len) {
		const c = code[i];
		const rest = code.slice(i);
		// Heredoc / nowdoc: <<<LABEL ... \nLABEL;  (nowdoc wraps label in '')
		if (rest.startsWith('<<<')) {
			const m = rest.match(
				/^<<<[ \t]*('?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/
			);
			if (m) {
				const label = m[2];
				const bodyStart = i + m[0].length;
				// Closing label may be indented (PHP 7.3+); match at line start.
				const closer = new RegExp(`(^|\\n)[ \\t]*${label}\\b`, 'g');
				closer.lastIndex = bodyStart;
				const found = closer.exec(code);
				const stop = found ? found.index + found[0].length : len;
				tokens.push(['string', code.slice(i, stop)]);
				i = stop;
				continue;
			}
		}
		// Block comment
		if (rest.startsWith('/*')) {
			const end = code.indexOf('*/', i + 2);
			const stop = end === -1 ? len : end + 2;
			tokens.push(['comment', code.slice(i, stop)]);
			i = stop;
			continue;
		}
		// Line comment ( // or # ).  #[ starts a PHP 8 attribute, not a comment.
		if (rest.startsWith('//') || (c === '#' && code[i + 1] !== '[')) {
			const end = code.indexOf('\n', i);
			const stop = end === -1 ? len : end;
			tokens.push(['comment', code.slice(i, stop)]);
			i = stop;
			continue;
		}
		// Quoted strings: '...', "...", `...` (shell exec)
		if (c === "'" || c === '"' || c === '`') {
			const stop = scanQuoted(i, c);
			tokens.push(['string', code.slice(i, stop)]);
			i = stop;
			continue;
		}
		// PHP open/close tags
		if (rest.startsWith('<?php') || rest.startsWith('<?=')) {
			const tag = rest.startsWith('<?php') ? '<?php' : '<?=';
			tokens.push(['tag', tag]);
			i += tag.length;
			continue;
		}
		if (rest.startsWith('?>')) {
			tokens.push(['tag', '?>']);
			i += 2;
			continue;
		}
		// Variable
		if (c === '$' && /[A-Za-z_]/.test(code[i + 1] || '')) {
			let j = i + 2;
			while (j < len && /[A-Za-z0-9_]/.test(code[j])) j++;
			tokens.push(['variable', code.slice(i, j)]);
			i = j;
			continue;
		}
		// Number
		if (/[0-9]/.test(c)) {
			let j = i + 1;
			while (j < len && /[0-9.eExX_]/.test(code[j])) j++;
			tokens.push(['number', code.slice(i, j)]);
			i = j;
			continue;
		}
		// Identifier (keyword vs. function call vs. class name)
		if (/[A-Za-z_]/.test(c)) {
			let j = i + 1;
			while (j < len && /[A-Za-z0-9_]/.test(code[j])) j++;
			const word = code.slice(i, j);
			let kind;
			if (PHP_KEYWORDS.has(word.toLowerCase())) {
				kind = 'keyword';
			} else if (/^[A-Z]/.test(word)) {
				kind = 'class';
			} else if (code[j] === '(') {
				kind = 'function';
			} else {
				kind = 'plain';
			}
			tokens.push([kind, word]);
			i = j;
			continue;
		}
		tokens.push(['plain', c]);
		i++;
	}
	return tokens
		.map(([kind, text]) =>
			kind === 'plain'
				? escapeHtml(text)
				: `<span class="t-${kind}">${escapeHtml(text)}</span>`
		)
		.join('');
}

const TEMPLATE_CSS = `
:host {
	display: block;
	margin: 16px 0;
	font-family: system-ui, -apple-system, sans-serif;
}
.card {
	border: 1px solid #e1e4e8;
	border-radius: 8px;
	overflow: hidden;
	background: #f6f8fa;
}
.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	background: #f6f8fa;
	border-bottom: 1px solid #e1e4e8;
	gap: 12px;
}
.name {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 13px;
	color: #57606a;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.run {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 14px;
	background: #2563eb;
	color: white;
	border: 0;
	border-radius: 6px;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
	flex-shrink: 0;
	width: 210px;
	max-width: 100%;
	justify-content: center;
}
.run:hover { background: #1d4ed8; }
.run[aria-busy="true"] { background: #93c5fd; cursor: progress; }
.run[aria-busy="true"]:hover { background: #93c5fd; }
.run-icon { font-size: 10px; }
.run-label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.run-shortcut {
	font-size: 11px;
	font-weight: 400;
	opacity: 0.82;
	flex-shrink: 0;
}
.run-spinner {
	display: none;
	flex-shrink: 0;
	width: 12px;
	height: 12px;
	border: 2px solid rgba(255, 255, 255, 0.45);
	border-top-color: #ffffff;
	border-radius: 50%;
	animation: php-snippet-spin 700ms linear infinite;
}
.run-percent {
	display: none;
	flex-shrink: 0;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}
.run[aria-busy="true"] .run-icon { display: none; }
.run[aria-busy="true"] .run-shortcut { display: none; }
.run[aria-busy="true"] .run-spinner,
.run[aria-busy="true"] .run-percent { display: inline-block; }
@keyframes php-snippet-spin {
	to { transform: rotate(360deg); }
}
pre {
	margin: 0;
	padding: 16px;
	overflow-x: auto;
	background: #ffffff;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 13px;
	line-height: 1.5;
	color: #24292f;
	white-space: pre;
	tab-size: 4;
}
.t-keyword  { color: #cf222e; font-weight: 500; }
.t-string   { color: #0a3069; }
.t-comment  { color: #6e7781; font-style: italic; }
.t-variable { color: #953800; }
.t-number   { color: #0550ae; }
.t-function { color: #8250df; }
.t-class    { color: #6f42c1; }
.t-tag      { color: #cf222e; font-weight: 500; }
.editor {
	position: relative;
	background: #fff;
}
.editor pre, .editor textarea {
	margin: 0;
	padding: 16px;
	border: 0;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 13px;
	line-height: 1.5;
	white-space: pre;
	tab-size: 4;
}
.editor pre {
	color: #24292f;
	overflow: hidden;
	min-height: 1.5em;
}
.editor textarea {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	resize: none;
	outline: 0;
	background: transparent;
	color: transparent;
	caret-color: #24292f;
	overflow: hidden;
}
.editor textarea::selection { background: #cfe7ff; color: transparent; }
.output {
	display: none;
	border-top: 1px solid #e1e4e8;
	background: #ffffff;
	color: #24292f;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 13px;
	line-height: 1.5;
}
.output.visible { display: block; }
.output-label {
	padding: 6px 14px;
	background: #f6f8fa;
	color: #57606a;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	border-bottom: 1px solid #d0d7de;
}
.output-body {
	padding: 14px;
	margin: 0;
	white-space: pre-wrap;
	word-break: break-word;
	max-height: 400px;
	overflow-y: auto;
}
.output-body.error { color: #ff8182; }
.powered-by {
	padding: 8px 14px;
	background: #f6f8fa;
	border-top: 1px solid #e1e4e8;
	color: #57606a;
	font-size: 12px;
	text-align: right;
}
.powered-by a {
	color: #0969da;
	text-decoration: none;
}
.powered-by a:hover {
	text-decoration: underline;
}
/*
 * Brief blue wash that fades to transparent every time the output is
 * refreshed. Re-running an idempotent snippet produces the same text, so
 * without a visible cue the click feels like a no-op — users were clicking
 * Run twice. The animation is purely cosmetic, ~700ms, with reduced-motion
 * users getting an instant on/off swap instead.
 */
.output-body.flash {
	animation: php-snippet-flash 700ms ease-out;
}
@keyframes php-snippet-flash {
	0%   { background-color: #dbeafe; }
	100% { background-color: #ffffff; }
}
@media (prefers-reduced-motion: reduce) {
	.output-body.flash {
		animation: php-snippet-flash 200ms steps(2, end);
	}
}
`;

class PhpSnippet extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._code = '';
		this._expectedOutput = null;
		this._ready = Promise.resolve();
		this._pendingRun = false;
		this._isRunning = false;
		this._rerunRequested = false;
		this._skipNextPointerClick = false;
		this._lastFocusedEditor = null;
		this._restoreEditorFocusAfterRun = false;
		this.shadowRoot.addEventListener('pointerdown', (event) => {
			const target = event.target;
			const runButton =
				target instanceof Element ? target.closest('.run') : null;
			if (!runButton || event.button !== 0) {
				return;
			}
			const activeElement =
				this._lastFocusedEditor || this.shadowRoot.activeElement;
			event.preventDefault();
			this._skipNextPointerClick = true;
			this._run();
			if (
				activeElement instanceof Element &&
				activeElement.matches('textarea.ta')
			) {
				this._restoreEditorFocusAfterRun = true;
				const restoreEditorFocus = () => this._restoreEditorFocus();
				document.addEventListener('pointerup', restoreEditorFocus, {
					once: true,
				});
				document.addEventListener('pointercancel', restoreEditorFocus, {
					once: true,
				});
			}
		});
		this.shadowRoot.addEventListener('click', (event) => {
			const target = event.target;
			if (target instanceof Element && target.closest('.run')) {
				if (this._skipNextPointerClick) {
					this._skipNextPointerClick = false;
					if (event.detail !== 0) {
						return;
					}
				}
				this._run();
			}
		});
		this.shadowRoot.addEventListener('keydown', (event) => {
			if (isRunShortcut(event)) {
				event.preventDefault();
				this._run();
			}
		});
	}

	connectedCallback() {
		this._expectedOutput = this._readExpectedOutput();
		this._ready = this._readCode().then((code) => {
			this._code = code.trim();
			this._render();
			if (this._expectedOutput !== null) {
				this._showExpectedOutput();
			}
			if (this._pendingRun) {
				this._pendingRun = false;
				queueMicrotask(() => this._run());
			}
		});
	}

	_showExpectedOutput() {
		const outputWrap = this.shadowRoot.querySelector('.output');
		const outputBody = this.shadowRoot.querySelector('.output-body');
		outputBody.classList.remove('error');
		outputBody.textContent = this._expectedOutput || '(no output)';
		outputWrap.classList.add('visible');
	}

	_readExpectedOutput() {
		const script = this.querySelector(
			'script[type="text/expected-output"]'
		);
		if (script) {
			return dedentLeading(script.textContent || '');
		}
		if (this.hasAttribute('expected-output')) {
			return this.getAttribute('expected-output');
		}
		return null;
	}

	async _readCode() {
		const src = this.getAttribute('src');
		if (src) {
			const res = await fetch(src);
			if (!res.ok) {
				throw new Error(
					`Failed to load PHP from ${src}: ${res.status} ${res.statusText}`
				);
			}
			return await res.text();
		}
		const script = this.querySelector(
			'script[type="application/x-php"], script[type="text/x-php"], script[type="text/php"]'
		);
		if (script) return script.textContent || '';
		return this.textContent || '';
	}

	_render() {
		const name = this.getAttribute('name') || 'snippet.php';
		const runnable = this.getAttribute('runnable') !== 'false';
		const editable =
			runnable &&
			!this.hasAttribute('readonly') &&
			this.getAttribute('editable') !== 'false';
		const runShortcut = getRunShortcutLabel();
		const style = document.createElement('style');
		style.textContent = TEMPLATE_CSS;
		const codeArea = editable
			? `<div class="editor">
					<pre aria-hidden="true"><code class="hl">${highlightPhp(this._code)}</code></pre>
					<textarea class="ta" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Editable PHP code"></textarea>
				</div>`
			: `<pre><code>${highlightPhp(this._code)}</code></pre>`;
		const tpl = document.createElement('template');
		tpl.innerHTML = `
			<div class="card">
				<div class="header">
					<span class="name">${escapeHtml(name)}</span>
					${
						runnable
							? `<button class="run" type="button">
								<span class="run-icon" aria-hidden="true">▶</span>
								<span class="run-spinner" aria-hidden="true"></span>
								<span class="run-label">Run</span>
								<span class="run-shortcut">${runShortcut}</span>
								<span class="run-percent" aria-hidden="true">0%</span>
							</button>`
							: ''
					}
				</div>
				${codeArea}
				<div class="output">
					<div class="output-label">Output</div>
					<pre class="output-body"></pre>
				</div>
				<div class="powered-by">
					<a href="${DOCS_URL}" target="_blank" rel="noopener noreferrer">PHP Code Snippet</a>
					powered by
					<a href="${PLAYGROUND_URL}" target="_blank" rel="noopener noreferrer">WordPress Playground</a>
				</div>
			</div>
		`;
		this.shadowRoot.replaceChildren(style, tpl.content);
		const runBtn = this.shadowRoot.querySelector('.run');
		if (runBtn) {
			runBtn.setAttribute('title', `Run (${runShortcut})`);
			runBtn.setAttribute(
				'aria-keyshortcuts',
				'Control+Enter Meta+Enter'
			);
		}
		if (editable) this._wireEditor();
	}

	_wireEditor() {
		const textarea = this.shadowRoot.querySelector('.ta');
		const hl = this.shadowRoot.querySelector('.hl');
		textarea.value = this._code;
		const sync = () => {
			this._code = textarea.value;
			hl.innerHTML = highlightPhp(this._code);
		};
		textarea.addEventListener('focus', () => {
			this._lastFocusedEditor = textarea;
		});
		textarea.addEventListener('input', sync);
		textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Tab') {
				e.preventDefault();
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				textarea.value =
					textarea.value.slice(0, start) +
					'\t' +
					textarea.value.slice(end);
				textarea.selectionStart = textarea.selectionEnd = start + 1;
				sync();
			}
		});
	}

	async _run() {
		const btn = this.shadowRoot.querySelector('.run');
		if (!btn) {
			this._pendingRun = true;
			return;
		}
		if (this._isRunning) {
			this._rerunRequested = true;
			this._setRunButtonProgress('Queued', 100);
			return;
		}

		this._isRunning = true;
		btn.setAttribute('aria-busy', 'true');
		try {
			await this._ready;
			do {
				this._rerunRequested = false;
				await this._runOnce(this._code);
			} while (this._rerunRequested);
		} finally {
			const currentBtn = this.shadowRoot.querySelector('.run') || btn;
			this._isRunning = false;
			currentBtn.removeAttribute('aria-busy');
			this._setRunButtonProgress('Run', 0);
			if (this._restoreEditorFocusAfterRun) {
				this._restoreEditorFocusAfterRun = false;
				this._restoreEditorFocus();
			}
		}
	}

	async _runOnce(code) {
		const outputWrap = this.shadowRoot.querySelector('.output');
		const outputBody = this.shadowRoot.querySelector('.output-body');
		outputBody.classList.remove('error');
		try {
			const { blueprint, key: blueprintKey } =
				resolveSetupBlueprint(this);
			const client = await getSharedClient(
				{
					origin:
						this.getAttribute('playground-origin') ||
						DEFAULT_ORIGIN,
					php: this.getAttribute('php') || DEFAULT_PHP,
					wp: this.getAttribute('wp') || DEFAULT_WP,
					blueprint,
					blueprintKey,
				},
				({ progress: pct, caption: cap }) => {
					const rounded = Math.round(pct);
					this._setRunButtonProgress(
						this._getRunProgressLabel(cap || 'Loading'),
						rounded
					);
				}
			);
			this._setRunButtonProgress('Running', 100);
			const response = await client.run({ code });
			outputBody.textContent = response.text || '(no output)';
			if (response.errors) {
				outputBody.textContent +=
					(outputBody.textContent ? '\n\n' : '') + response.errors;
			}
			outputWrap.classList.add('visible');
			this._flashOutput(outputBody);
		} catch (err) {
			outputBody.classList.add('error');
			outputBody.textContent = String(
				err && err.message ? err.message : err
			);
			outputWrap.classList.add('visible');
			this._flashOutput(outputBody);
		}
	}

	_setRunButtonProgress(label, pct) {
		const runLabel = this.shadowRoot.querySelector('.run-label');
		const runPercent = this.shadowRoot.querySelector('.run-percent');
		if (runLabel) {
			runLabel.textContent = label;
		}
		if (runPercent) {
			runPercent.textContent = Math.round(pct) + '%';
		}
	}

	_getRunProgressLabel(label) {
		if (
			(this.getAttribute('wp') || DEFAULT_WP) === 'none' &&
			label === 'Preparing WordPress'
		) {
			return 'Preparing runtime';
		}
		return label;
	}

	_restoreEditorFocus() {
		const editor = this._lastFocusedEditor;
		if (!(editor instanceof Element) || !editor.isConnected) {
			return;
		}
		requestAnimationFrame(() => {
			if (editor.isConnected) {
				editor.focus({ preventScroll: true });
			}
		});
	}

	/*
	 * Restart the flash animation on every Run, even if the previous one
	 * is mid-fade. Removing the class, forcing a synchronous reflow, then
	 * re-adding it is the standard trick to retrigger a CSS animation.
	 * The class is cleared on animationend so the DOM doesn't carry stale
	 * state between runs.
	 */
	_flashOutput(outputBody) {
		outputBody.classList.remove('flash');
		outputBody.getBoundingClientRect();
		outputBody.classList.add('flash');
		const clear = () => {
			outputBody.classList.remove('flash');
			outputBody.removeEventListener('animationend', clear);
		};
		outputBody.addEventListener('animationend', clear);
	}
}

function isRunShortcut(event) {
	return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

function getRunShortcutLabel() {
	const platform =
		navigator.userAgentData && navigator.userAgentData.platform
			? navigator.userAgentData.platform
			: navigator.platform || '';
	return /mac|iphone|ipad|ipod/i.test(platform) ? 'Cmd+Enter' : 'Ctrl+Enter';
}

customElements.define('php-snippet', PhpSnippet);
