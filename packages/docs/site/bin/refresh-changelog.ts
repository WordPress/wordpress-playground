import fs from 'fs';

const sourcePath = __dirname + '/../../../../CHANGELOG.md';
const destinationPath = __dirname + '/../docs/main/changelog.md';

// Read the source file
const changelog = fs.readFileSync(sourcePath, 'utf-8');

// Extract frontmatter from destinationPath
const existingContent = fs.readFileSync(destinationPath, 'utf-8');
const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
const existingFrontmatter = existingContent.match(frontmatterRegex)?.[0] || '';

const changelogWithFrontmatter = existingFrontmatter + '\n\n' + changelog;

// Write the modified changelog to the destination file
fs.writeFileSync(destinationPath, changelogWithFrontmatter, 'utf-8');

console.log('Changelog copied and frontmatter prepended successfully!');
