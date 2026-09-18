import fs from 'fs';

const sourcePath = __dirname + '/../../../../CHANGELOG.md';
const destinationPath = __dirname + '/../docs/main/changelog.md';

// Read the source file
const changelog = fs.readFileSync(sourcePath, 'utf-8');

// Extract frontmatter from destinationPath
const existingContent = fs.readFileSync(destinationPath, 'utf-8');
const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
const existingFrontmatter = existingContent.match(frontmatterRegex)?.[0] || '';

// Docusaurus 3 parses `.md` files through the MDX pipeline, so unescaped
// `{` / `}` in PR titles (e.g. `@php-wasm/{web,node}-5-2`) get read as JSX
// expressions and crash the SSG with `ReferenceError: web is not defined`.
// The destination file opts into CommonMark via `mdx.format: md`, but also
// escape braces so the content stays inert if Docusaurus parses it as MDX.
const escapedChangelog = changelog.replace(/[{}]/g, (c) => '\\' + c);
const changelogWithFrontmatter =
	existingFrontmatter + '\n\n' + escapedChangelog;

// Write the modified changelog to the destination file
fs.writeFileSync(destinationPath, changelogWithFrontmatter, 'utf-8');

console.log('Changelog copied and frontmatter prepended successfully!');
