#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fastGlob = require('fast-glob');
const gettextParser = require('gettext-parser');

const TEXT_DOMAIN = 'playground-website';
const WEBSITE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEBSITE_ROOT, '../../..');
const SRC_ROOT = path.join(WEBSITE_ROOT, 'src');
const LANGUAGES_DIR = path.join(WEBSITE_ROOT, 'languages');
const LOCALES_DIR = path.join(SRC_ROOT, 'lib/i18n/locales');
const POT_FILE = path.join(LANGUAGES_DIR, `${TEXT_DOMAIN}.pot`);

const LOCALES = [
	{
		locale: 'es_ES',
		englishName: 'Spanish (Spain)',
		pluralForms: 'nplurals=2; plural=(n != 1);',
	},
	{
		locale: 'pt_BR',
		englishName: 'Portuguese (Brazil)',
		pluralForms: 'nplurals=2; plural=(n > 1);',
	},
];

main();

function main() {
	const command = process.argv[2];
	if (command === 'extract') {
		extract();
	} else if (command === 'update') {
		update();
	} else if (command === 'compile') {
		compile();
	} else {
		throw new Error('Usage: node i18n.cjs <extract|update|compile>');
	}
}

function extract() {
	const messages = extractMessages();
	writePot(messages);
	console.log(`Extracted ${messages.size} strings to ${relative(POT_FILE)}`);
}

function update() {
	const pot = parsePo(POT_FILE);
	const messages = readMessagesFromPo(pot);
	const potCreationDate = getHeaderValue(pot.headers, 'POT-Creation-Date');
	ensureDir(LANGUAGES_DIR);
	for (const locale of LOCALES) {
		writeLocalePo(locale, messages, potCreationDate);
	}
}

function compile() {
	ensureDir(LOCALES_DIR);
	for (const locale of LOCALES) {
		const poFile = getPoFile(locale.locale);
		const po = parsePo(poFile);
		writeLocaleJson(locale, po);
	}
}

function extractMessages() {
	const messages = new Map();
	const files = fastGlob.sync(['**/*.{ts,tsx}'], {
		cwd: SRC_ROOT,
		absolute: true,
		ignore: [
			'**/*.spec.ts',
			'**/*.spec.tsx',
			'**/*.test.ts',
			'**/*.test.tsx',
			'lib/i18n/**',
		],
	});

	for (const file of files.sort()) {
		const source = fs.readFileSync(file, 'utf8');
		const ast = parser.parse(source, {
			sourceType: 'module',
			plugins: ['typescript', 'jsx', 'importMeta', 'dynamicImport'],
		});
		traverse(ast, {
			CallExpression(callPath) {
				const message = getMessageFromCall(callPath.node);
				if (!message) {
					return;
				}
				message.reference = `${relative(file)}:${callPath.node.loc.start.line}`;
				message.extracted = getTranslatorComment(
					source,
					callPath.node.start
				);
				addMessage(messages, message);
			},
		});
	}

	return messages;
}

function writePot(messages) {
	const potCreationDate = getStablePotCreationDate(messages);
	const pot = createPoFile({
		headers: getPotHeaders(potCreationDate),
		messages,
	});
	ensureDir(LANGUAGES_DIR);
	writeIfChanged(POT_FILE, compilePo(pot));
}

function getStablePotCreationDate(messages) {
	if (!fs.existsSync(POT_FILE)) {
		return getTodayHeaderDate();
	}
	const existingContents = fs.readFileSync(POT_FILE, 'utf8');
	const existingPot = gettextParser.po.parse(existingContents, 'utf-8');
	const existingDate = getHeaderValue(
		existingPot.headers,
		'POT-Creation-Date'
	);
	if (!existingDate) {
		return getTodayHeaderDate();
	}
	const candidate = compilePo(
		createPoFile({
			headers: getPotHeaders(existingDate),
			messages,
		})
	);
	if (stripHeaderBlock(candidate) === stripHeaderBlock(existingContents)) {
		return existingDate;
	}
	return getTodayHeaderDate();
}

function stripHeaderBlock(poContents) {
	const normalized = poContents.replace(/\r\n/g, '\n');
	const separatorIndex = normalized.indexOf('\n\n');
	return separatorIndex === -1 ? '' : normalized.slice(separatorIndex + 2);
}

function readMessagesFromPo(po) {
	const messages = new Map();
	for (const [context, translations] of Object.entries(po.translations)) {
		for (const translation of Object.values(translations)) {
			if (!translation.msgid) {
				continue;
			}
			addMessage(messages, {
				msgid: translation.msgid,
				msgidPlural: translation.msgid_plural,
				msgctxt: context || undefined,
				reference: translation.comments?.reference,
				extracted: translation.comments?.extracted,
			});
		}
	}
	return messages;
}

function writeLocalePo(locale, messages, potCreationDate) {
	const poFile = getPoFile(locale.locale);
	const existingPo = fs.existsSync(poFile) ? parsePo(poFile) : null;
	const po = createPoFile({
		headers: getLocaleHeaders(locale, existingPo, potCreationDate),
		messages,
		getMsgstr(message) {
			const existing = getExistingTranslation(existingPo, message);
			if (hasTranslations(existing?.msgstr)) {
				return existing.msgstr;
			}
			return getEmptyMsgstr(message, locale);
		},
		getEntryComments(message) {
			const existing = getExistingTranslation(existingPo, message);
			return getComments(message, existing?.comments);
		},
	});
	writeIfChanged(poFile, compilePo(po));
	console.log(`Updated ${relative(poFile)}`);
}

function writeLocaleJson(locale, po) {
	const jsonFile = path.join(LOCALES_DIR, `${locale.locale}.json`);
	const localeData = {
		'': {
			domain: TEXT_DOMAIN,
			lang: locale.locale,
			'plural-forms': locale.pluralForms,
		},
	};

	for (const [context, translations] of Object.entries(po.translations)) {
		for (const translation of Object.values(translations)) {
			if (
				!translation.msgid ||
				isFuzzy(translation) ||
				!hasTranslations(translation.msgstr)
			) {
				continue;
			}
			const key = context
				? `${context}\u0004${translation.msgid}`
				: translation.msgid;
			localeData[key] = translation.msgstr;
		}
	}

	const output = {
		'translation-revision-date':
			getHeaderValue(po.headers, 'PO-Revision-Date') ||
			'YEAR-MO-DA HO:MI+ZONE',
		generator: 'WordPress Playground i18n tooling',
		domain: TEXT_DOMAIN,
		locale_data: {
			[TEXT_DOMAIN]: localeData,
		},
	};
	writeIfChanged(jsonFile, `${JSON.stringify(output, null, '\t')}\n`);
	console.log(`Generated ${relative(jsonFile)}`);
}

function createPoFile({
	headers,
	messages,
	getMsgstr = () => [''],
	getEntryComments = getComments,
}) {
	const translations = {
		'': {
			'': {
				msgid: '',
				msgstr: [''],
			},
		},
	};

	for (const message of [...messages.values()].sort(compareMessages)) {
		const context = message.msgctxt || '';
		translations[context] ||= {};
		translations[context][message.msgid] = {
			msgctxt: message.msgctxt,
			msgid: message.msgid,
			msgid_plural: message.msgidPlural,
			msgstr: getMsgstr(message),
			comments: getEntryComments(message),
		};
	}

	return {
		charset: 'utf-8',
		headers,
		translations,
	};
}

function compilePo(po) {
	// gettext-parser normalizes the charset parameter to lowercase "utf-8";
	// restore canonical "UTF-8" while keeping a single Content-Type header.
	return gettextParser.po
		.compile(po)
		.toString('utf8')
		.replace(
			'"Content-Type: text/plain; charset=utf-8\\n"',
			'"Content-Type: text/plain; charset=UTF-8\\n"'
		);
}

function getMessageFromCall(node) {
	const callee = getCalleeName(node.callee);
	if (!['__', '_x', '_n', '_nx'].includes(callee)) {
		return null;
	}

	if (callee === '__') {
		return getSimpleMessage(node.arguments, 0, 1);
	}
	if (callee === '_x') {
		return getContextMessage(node.arguments, 0, 1, 2);
	}
	if (callee === '_n') {
		return getPluralMessage(node.arguments, 0, 1, undefined, 3);
	}
	return getPluralMessage(node.arguments, 0, 1, 3, 4);
}

function getSimpleMessage(args, msgidIndex, domainIndex) {
	const domain = getStringValue(args[domainIndex]);
	if (domain !== TEXT_DOMAIN) {
		return null;
	}
	const msgid = getStringValue(args[msgidIndex]);
	return msgid ? { msgid } : null;
}

function getContextMessage(args, msgidIndex, contextIndex, domainIndex) {
	const message = getSimpleMessage(args, msgidIndex, domainIndex);
	if (!message) {
		return null;
	}
	const context = getStringValue(args[contextIndex]);
	return context ? { ...message, msgctxt: context } : null;
}

function getPluralMessage(
	args,
	singleIndex,
	pluralIndex,
	contextIndex,
	domainIndex
) {
	const message = getSimpleMessage(args, singleIndex, domainIndex);
	if (!message) {
		return null;
	}
	const msgidPlural = getStringValue(args[pluralIndex]);
	const msgctxt =
		contextIndex === undefined
			? undefined
			: getStringValue(args[contextIndex]);
	if (!msgidPlural || (contextIndex !== undefined && !msgctxt)) {
		return null;
	}
	return { ...message, msgidPlural, msgctxt };
}

function getStringValue(node) {
	if (!node) {
		return null;
	}
	if (node.type === 'StringLiteral') {
		return node.value;
	}
	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		return node.quasis[0].value.cooked;
	}
	return null;
}

function getCalleeName(callee) {
	if (callee.type === 'Identifier') {
		return callee.name;
	}
	if (
		callee.type === 'MemberExpression' &&
		callee.property.type === 'Identifier'
	) {
		return callee.property.name;
	}
	return null;
}

function getTranslatorComment(source, start) {
	const previousSource = source.slice(Math.max(0, start - 400), start);
	const lines = previousSource.split(/\r?\n/).slice(-6).join('\n');
	const comment = lines.match(/\/\*\s*translators:\s*([\s\S]*?)\*\/\s*$/i);
	return comment ? comment[1].replace(/\s+/g, ' ').trim() : undefined;
}

function addMessage(messages, message) {
	const key = getMessageKey(message);
	const existing = messages.get(key);
	if (!existing) {
		messages.set(key, {
			...message,
			references: message.reference
				? new Set(message.reference.split('\n').filter(Boolean))
				: new Set(),
			extractedComments: message.extracted
				? new Set(message.extracted.split('\n').filter(Boolean))
				: new Set(),
		});
		return;
	}
	if (message.msgidPlural && !existing.msgidPlural) {
		existing.msgidPlural = message.msgidPlural;
	}
	if (message.reference) {
		for (const ref of message.reference.split('\n').filter(Boolean)) {
			existing.references.add(ref);
		}
	}
	if (message.extracted) {
		for (const comment of message.extracted.split('\n').filter(Boolean)) {
			existing.extractedComments.add(comment);
		}
	}
}

function getMessageKey(message) {
	return `${message.msgctxt || ''}\u0004${message.msgid}`;
}

function getExistingTranslation(existingPo, message) {
	if (!existingPo) {
		return null;
	}
	const translations = existingPo.translations[message.msgctxt || ''];
	return translations?.[message.msgid] || null;
}

function getEmptyMsgstr(message, locale) {
	const count = message.msgidPlural ? getPluralCount(locale.pluralForms) : 1;
	return Array.from({ length: count }, () => '');
}

function getPluralCount(pluralForms) {
	const match = pluralForms.match(/nplurals\s*=\s*(\d+)/);
	return match ? Number(match[1]) : 2;
}

function hasTranslations(msgstr) {
	return Array.isArray(msgstr) && msgstr.some((value) => value);
}

function isFuzzy(translation) {
	const flag = translation.comments?.flag;
	if (!flag) {
		return false;
	}
	return flag.split(/[,\n]/).some((entry) => entry.trim() === 'fuzzy');
}

function getComments(message, existingComments) {
	const comments = {};
	if (existingComments?.translator) {
		comments.translator = existingComments.translator;
	}
	if (message.references?.size) {
		comments.reference = [...message.references].sort().join('\n');
	} else if (message.reference) {
		comments.reference = message.reference;
	}
	if (message.extractedComments?.size) {
		comments.extracted = [...message.extractedComments].join('\n');
	} else if (message.extracted) {
		comments.extracted = message.extracted;
	}
	if (existingComments?.flag) {
		comments.flag = existingComments.flag;
	}
	return comments;
}

function getPotHeaders(potCreationDate = getTodayHeaderDate()) {
	return {
		'Project-Id-Version': 'WordPress Playground Website',
		'Report-Msgid-Bugs-To':
			'https://github.com/WordPress/wordpress-playground/issues',
		'POT-Creation-Date': potCreationDate,
		'PO-Revision-Date': 'YEAR-MO-DA HO:MI+ZONE',
		'Last-Translator': 'FULL NAME <EMAIL@ADDRESS>',
		'Language-Team': 'LANGUAGE <LL@li.org>',
		'MIME-Version': '1.0',
		// Use lowercase "content-type" so gettext-parser updates it in place
		// instead of appending a duplicate "Content-Type: text/plain;" header.
		'content-type': 'text/plain; charset=UTF-8',
		'Content-Transfer-Encoding': '8bit',
		'X-Generator': 'WordPress Playground i18n tooling',
		'X-Domain': TEXT_DOMAIN,
	};
}

function getHeaderValue(headers, name) {
	if (!headers) {
		return undefined;
	}
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lower && value) {
			return value;
		}
	}
	return undefined;
}

function getLocaleHeaders(locale, existingPo, potCreationDate) {
	const existingHeaders = existingPo?.headers;
	return {
		...getPotHeaders(
			potCreationDate ||
				getHeaderValue(existingHeaders, 'POT-Creation-Date') ||
				getTodayHeaderDate()
		),
		'PO-Revision-Date':
			getHeaderValue(existingHeaders, 'PO-Revision-Date') ||
			'YEAR-MO-DA HO:MI+ZONE',
		'Last-Translator':
			getHeaderValue(existingHeaders, 'Last-Translator') ||
			'FULL NAME <EMAIL@ADDRESS>',
		Language: locale.locale,
		'Language-Team': `${locale.englishName} <LL@li.org>`,
		'Plural-Forms': locale.pluralForms,
		'X-Domain': TEXT_DOMAIN,
	};
}

function getTodayHeaderDate() {
	return `${new Date().toISOString().slice(0, 10)} 00:00+0000`;
}

function compareMessages(a, b) {
	const keyA = getMessageKey(a);
	const keyB = getMessageKey(b);
	if (keyA < keyB) {
		return -1;
	}
	if (keyA > keyB) {
		return 1;
	}
	return 0;
}

function parsePo(poFile) {
	return gettextParser.po.parse(fs.readFileSync(poFile), 'utf-8');
}

function getPoFile(locale) {
	return path.join(LANGUAGES_DIR, `${TEXT_DOMAIN}-${locale}.po`);
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeIfChanged(file, contents) {
	const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
	if (fs.existsSync(file) && fs.readFileSync(file).equals(buffer)) {
		return;
	}
	ensureDir(path.dirname(file));
	fs.writeFileSync(file, buffer);
}

function relative(file) {
	return path.relative(REPO_ROOT, file).replace(/\\/g, '/');
}
