const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const DOCS_ABSOLUTE_URL =
	'https://github.com/WordPress/wordpress-playground/tree/trunk/docs/';

const REPO_ROOT_PATH = process.cwd();
const TARGET_DIR = path.join(REPO_ROOT_PATH, 'docs');

/**
 * Loop through all the doc markdown files.
 */
console.log(`Building the markdown files...`);

for (const sourcePath of globSync('docs/*.md', { cwd: REPO_ROOT_PATH })) {
	console.log(`${sourcePath}...`);
	const targetFileName = path.basename(sourcePath);
	const targetFilePath = `${TARGET_DIR}/${targetFileName}`;
	fs.copyFileSync(sourcePath, targetFilePath);
	let content = fs.readFileSync(targetFilePath, 'utf8');
	content = handleIncludes(targetFilePath, content);
	content = absoluteUrlsToRelativeUrls(targetFilePath, content);
	fs.writeFileSync(targetFilePath, content);
}

function absoluteUrlsToRelativeUrls(filePath, content) {
	const relativePath = path.relative(path.dirname(filePath), TARGET_DIR);
	return content.replace(
		new RegExp(
			'(\\]\\()' + escapeRegExp(DOCS_ABSOLUTE_URL) + '([^\\)]+\\.md)',
			'g'
		),
		`$1${relativePath}$2`
	);
}

/**
 * Find all "include statements" in a markdown file. An "include statement" has an opener
 * and an ender as follows:
 *
 * ```
 * <!-- include path/to/file.md#section -->
 *    ... arbitrary contents ...
 * <!-- /include path/to/file.md#section -->
 * ```
 *
 * Then, replace the contents inside of the include statement with the contents
 * of the specific header from the requested file.
 *
 * @param {string} filePath
 * @param {string} content
 */
function handleIncludes(filePath, content) {
	const regex = /<!-- include (.*?) -->(.*)<!-- \/include \1 -->/gms;
	return content.replace(regex, (match, includeRef) => {
		const [includePath, headerText] = includeRef.split('#');
		const relativeIncludePath = path.relative(
			TARGET_DIR,
			includePath.startsWith('/')
				? REPO_ROOT_PATH + includePath
				: includePath
		);
		const absoluteIncludePath = path.join(TARGET_DIR, relativeIncludePath);
		if (!fs.existsSync(absoluteIncludePath)) {
			throw new Error(
				`File ${includePath} included in ${path.relative(
					REPO_ROOT_PATH,
					filePath
				)} does not exist`
			);
		}
		const includeContents = fs.readFileSync(absoluteIncludePath, 'utf8');
		const sectionContents = getMarkdownSectionContents(
			includeContents,
			headerText,
			true
		).replace(/\]\(([^)]+)\)/g, (_, link) => {
			if (link.startsWith('https://')) {
				return `](${link})`;
			}
			return `](${relativeIncludePath})`;
		});
		// console.log(sectionContents);
		if (!sectionContents) {
			throw new Error(
				`Section "${headerText}" not found in the file ${includePath} (included in ${filePath})`
			);
		}

		return `<!-- include ${includeRef} -->\n\n${sectionContents}\n\n<!-- /include ${includeRef} -->`;
	});
}

/**
 * Finds a specified header in a markdown file, and returns
 * all the content belonging to that header.
 *
 * @param {string} content
 * @param {string} header
 * @param {boolean} stopAtFirstHeader
 */
function getMarkdownSectionContents(
	content,
	header,
	stopAtFirstHeader = false
) {
	let regex;
	if (stopAtFirstHeader) {
		regex = new RegExp(
			`^(#+)\\s*${escapeRegExp(header)}\\s*\\n(.*?)(^#)`,
			'ms'
		);
	} else {
		regex = new RegExp(
			`^(#+)\\s*${escapeRegExp(header)}\\s*\\n(.*)(^\\1)`,
			'ms'
		);
	}
	const match = content.match(regex);
	if (match) {
		return match[2].trim();
	}
	return '';
}

function escapeRegExp(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
