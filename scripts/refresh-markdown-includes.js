const fs = require('fs');
const path = require('path');

/**
 * Loop through all the markdown files given as the CLI argument.
 */
const files = process.argv.slice(2);
if (!files.length) {
	console.log(
		`This script will replace all the "include" statements in the given markdown files ` +
			`with the contents of the specified files. If the file path starts with a "/" character, ` +
			`the path will be based at the repo root. For example: /docs/index.md.\n\n` +
			'Usage: node scripts/refresh-markdown-includes.js <file1> <file2> ...'
	);
	process.exit(1);
}

files.forEach((file) => {
	console.log(`Updating ${file}...`);
	if (file.startsWith('/')) {
		file = path.join(__dirname, '..', file);
	}
	const content = fs.readFileSync(file, 'utf8');
	const updatedContent = updateIncludes(file, content);
	fs.writeFileSync(file, updatedContent);
});

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
 * @param {string} file
 * @param {string} content
 */
function updateIncludes(file, content) {
	const regex = /<!-- include (.*?) -->(.*)<!-- \/include \1 -->/gms;
	return content.replace(regex, (match, includePath) => {
		const [filePath, header] = includePath.split('#');
		const fileContents = fs.readFileSync(
			path.join(__dirname, '..', filePath),
			'utf8'
		);
		const sectionContents = getMarkdownSectionContents(
			fileContents,
			header
		);
		if (!sectionContents) {
			throw new Error(
				`Section "${header}" not found in the file ${filePath} (included in ${file})`
			);
		}
		return `<!-- include ${includePath} -->\n\n${sectionContents}\n\n<!-- /include ${includePath} -->`;
	});
}

/**
 * Finds a specified header in a markdown file, and returns
 * all the content belonging to that header.
 *
 * @param {string} content
 * @param {string} header
 */
function getMarkdownSectionContents(content, header) {
	const regex = new RegExp(
		`^(#+)\\s*${escapeRegExp(header)}\\s*\\n(.*)(^\\1|$)`,
		'ms'
	);
	const match = content.match(regex);
	console.log({ match });
	if (match) {
		return match[2].trim();
	}
	return '';
}

function escapeRegExp(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
