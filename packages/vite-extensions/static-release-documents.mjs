import { readdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { gunzipSync } from 'node:zlib';
import { SaxesParser } from 'saxes';
import { createHash } from 'node:crypto';
import exceptions from '../playground/wordpress-builds/build/static-document-exceptions.json' with { type: 'json' };
import { joinPaths } from '../php-wasm/util/src/lib/paths.ts';

/**
 * Check WordPress documents before publishing them on the app origin. Use the
 * browser's document model and DOMPurify's maintained policy instead of matching
 * script spellings. Reject changes; never rewrite WordPress templates or SVGs.
 */
export async function validateWordPressStaticDocuments(directory) {
	for (const file of await readdir(directory, { recursive: true })) {
		if (
			!/^wp-[^/]+\//.test(file) ||
			!/\.(?:html?|shtml|xhtml|svgz?|xml|xsl|xslt|rss|atom|kml|xspf)$/i.test(
				file
			)
		)
			continue;
		const bytes = await readFile(joinPaths(directory, file));
		let source = /\.svgz$/i.test(file) ? gunzipSync(bytes) : bytes;
		const isHtml = /\.(?:html?|shtml)$/i.test(file);
		if (!isHtml) {
			// XML declarations can select encodings the DOM parser does not decode.
			// Fail closed on those instead of mistaking undecoded script for invalid
			// XML. HTML bytes go directly to JSDOM's BOM/meta charset sniffer.
			try {
				source = new TextDecoder('utf-8', { fatal: true }).decode(
					source
				);
				const encoding = source.match(
					/^<\?xml\s[^?]*\bencoding\s*=\s*(['"])(.*?)\1/i
				)?.[2];
				if (
					source.includes('\0') ||
					(encoding && !/^(?:utf-8|us-ascii)$/i.test(encoding))
				)
					throw new Error('Expected UTF-8 XML.');
			} catch (error) {
				throw new Error(
					`Unsupported encoding in WordPress static document: ${file}`,
					{ cause: error }
				);
			}
			// jsdom expands entity replacement markup as text; browsers can parse
			// it as executable elements. Its XML tokenizer exposes the DTD that the
			// DOM does not, so reject internal subsets before comparing DOM trees.
			let internalSubset = false;
			const parser = new SaxesParser();
			parser.on('doctype', (doctype) => {
				internalSubset ||= doctype.includes('[');
			});
			// The DOM parse below handles XML syntax; this pass only inspects DTDs.
			parser.on('error', () => {});
			parser.write(source).close();
			if (internalSubset)
				throw new Error(
					`Active WordPress static document: ${file} (XML declarations)`
				);
		}
		let dom;
		try {
			dom = new JSDOM(source, {
				contentType: isHtml ? 'text/html' : 'application/xhtml+xml',
			});
		} catch (error) {
			// Browsers can execute XML scripts before encountering a later parse error.
			// Only reviewed, byte-identical upstream defects may bypass parsing.
			if (!isHtml && error.name === 'SyntaxError') {
				if (
					exceptions[file] ===
					createHash('sha256').update(bytes).digest('hex')
				)
					continue;
				throw new Error(
					`Malformed WordPress static document: ${file}`,
					{ cause: error }
				);
			}
			throw error;
		}
		try {
			const { document, NodeFilter } = dom.window;
			const doctype = document.doctype;
			// Keep the fixed, passive SVG 1.1 font declaration shipped by WordPress;
			// arbitrary external DTDs could define markup outside the scanned file.
			if (
				doctype &&
				(doctype.publicId || doctype.systemId) &&
				!(
					doctype.name === 'svg' &&
					doctype.publicId === '-//W3C//DTD SVG 1.1//EN' &&
					doctype.systemId ===
						'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'
				)
			) {
				throw new Error('External XML declarations are not permitted.');
			}
			const instructions = document.createTreeWalker(
				document,
				NodeFilter.SHOW_PROCESSING_INSTRUCTION
			);
			if (instructions.nextNode())
				throw new Error(
					'XML processing instructions are not permitted.'
				);
			removeComments(document.documentElement);
			const root = isHtml
				? document.documentElement
				: document.createElementNS(
						'http://www.w3.org/1999/xhtml',
						'div'
					);
			if (!isHtml) appendBrowserMarkup(root, document.documentElement);
			const original = root.cloneNode(true);
			createDOMPurify(dom.window).sanitize(root, {
				IN_PLACE: true,
				WHOLE_DOCUMENT: isHtml,
				// No trusted app code runs in these documents. Preserve legitimate
				// IDs and passive legacy SVG font metadata rather than clobber-proofing.
				SANITIZE_DOM: false,
				ADD_TAGS: ['font-face', 'missing-glyph'],
				ADD_ATTR: [
					'horiz-adv-x',
					'enable-background',
					'focusable',
					'descent',
					'units-per-em',
					'unicode-range',
					'underline-position',
					'underline-thickness',
					'bbox',
					'panose-1',
				],
				FORBID_TAGS: [
					'animate',
					'animateMotion',
					'animateTransform',
					'set',
				],
			});
			// DOMPurify trims attribute values, including a glyph's literal space.
			// Ignore that normalization when comparing; the source is never written.
			trimAttributeValues(original);
			trimAttributeValues(root);
			if (!original.isEqualNode(root))
				throw new Error('The document requires sanitization.');
		} catch (error) {
			throw new Error(`Active WordPress static document: ${file}`, {
				cause: error,
			});
		} finally {
			dom.window.close();
		}
	}
}

/** Inspect all browser markup, including descendants of passive XML/editor metadata. */
function appendBrowserMarkup(parent, node) {
	const known = [
		'http://www.w3.org/1999/xhtml',
		'http://www.w3.org/2000/svg',
		'http://www.w3.org/1998/Math/MathML',
	];
	let target = parent;
	if (node.nodeType === 1 && known.includes(node.namespaceURI)) {
		// DOMPurify omits passive SVG metadata wrappers; inspect their attributes
		// on a neutral SVG group so handlers cannot hide on the wrapper itself.
		if (node.namespaceURI === known[1] && node.localName === 'metadata') {
			target = node.ownerDocument.createElementNS(known[1], 'g');
			for (const attribute of node.attributes)
				target.setAttributeNS(
					attribute.namespaceURI,
					attribute.name,
					attribute.value
				);
		} else target = node.cloneNode(false);
		for (const attribute of Array.from(target.attributes)) {
			if (
				attribute.namespaceURI &&
				![
					'http://www.w3.org/1999/xlink',
					'http://www.w3.org/XML/1998/namespace',
				].includes(attribute.namespaceURI)
			)
				target.removeAttributeNode(attribute);
		}
		parent.appendChild(target);
	} else if (node.nodeType === 3) {
		parent.appendChild(node.cloneNode());
	}
	for (const child of node.childNodes) appendBrowserMarkup(target, child);
	if ('content' in node && node.content?.nodeType === 11)
		for (const child of node.content.childNodes)
			appendBrowserMarkup(target.content, child);
}

function trimAttributeValues(node) {
	if (node.nodeType === 1) {
		for (const attribute of node.attributes)
			attribute.value = attribute.value.trim();
	}
	for (const child of node.childNodes) trimAttributeValues(child);
	if ('content' in node && node.content?.nodeType === 11)
		trimAttributeValues(node.content);
}

function removeComments(node) {
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === 8) child.parentNode.removeChild(child);
		else removeComments(child);
	}
	if ('content' in node && node.content?.nodeType === 11)
		removeComments(node.content);
}

/** Guard every app HTML file, including public files Vite copies without transforming. */
export async function protectStaticReleasePages(
	directory,
	appOrigin,
	wordPressOrigin
) {
	for (const file of await readdir(directory, { recursive: true })) {
		if (!/\.html?$/i.test(file) || /^wp-[^/]+\//.test(file)) continue;
		const path = joinPaths(directory, file);
		const html = await readFile(path, 'utf8');
		const expected =
			file === 'wordpress-bridge.html' ? wordPressOrigin : appOrigin;
		const script =
			`<script>if(location.origin!==${JSON.stringify(expected)}){` +
			`document.write('<p>This Playground page cannot run on this host.</p><plaintext hidden>');` +
			`throw new Error('Playground page loaded on '+location.origin)}</script>`;
		const dom = new JSDOM(html, { includeNodeLocations: true });
		try {
			const offset = dom.nodeLocation(dom.window.document.head)?.startTag
				?.endOffset;
			if (offset === undefined)
				throw new Error(
					`Missing explicit head in Playground page: ${file}`
				);
			await writeFile(
				path,
				html.slice(0, offset) + script + html.slice(offset)
			);
		} finally {
			dom.window.close();
		}
	}
}
