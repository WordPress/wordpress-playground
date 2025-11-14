const fs = require('fs');
const path = require('path');

const docsDir = './docs';
const sidebars = require('./sidebars.js');

// Function to get frontmatter from markdown file
function getFrontmatter(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;
    
    const frontmatter = {};
    const lines = match[1].split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            frontmatter[key.trim()] = valueParts.join(':').trim();
        }
    }
    return frontmatter;
}

// Get all markdown files recursively
function getAllMarkdownFiles(dir, baseDir = dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip _fragments directory
            if (entry.name === '_fragments') continue;
            files = files.concat(getAllMarkdownFiles(fullPath, baseDir));
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            const relativePath = path.relative(baseDir, fullPath);
            files.push(relativePath);
        }
    }
    return files;
}

// Function to extract all doc IDs from sidebar config
function extractDocIds(items) {
    let ids = [];
    for (const item of items) {
        if (typeof item === 'string') {
            ids.push(item);
        } else if (item.type === 'category') {
            if (item.link && item.link.id) {
                ids.push(item.link.id);
            }
            if (item.items) {
                ids = ids.concat(extractDocIds(item.items));
            }
        } else if (item.type === 'doc' && item.id) {
            ids.push(item.id);
        }
    }
    return ids;
}

// Get all sidebar IDs
let allSidebarIds = [];
for (const sidebarKey in sidebars) {
    allSidebarIds = allSidebarIds.concat(extractDocIds(sidebars[sidebarKey]));
}

// Get all file IDs
const allFiles = getAllMarkdownFiles(docsDir);
const fileIds = new Map();

allFiles.forEach(file => {
    const fullPath = path.join(docsDir, file);
    const fm = getFrontmatter(fullPath);
    let docId;
    
    if (fm && fm.id) {
        docId = fm.id;
        // Determine directory prefix
        const dir = path.dirname(file);
        if (dir !== '.') {
            const topLevel = dir.split(path.sep)[0];
            docId = `${topLevel}/${fm.id}`;
        }
    } else {
        // Construct default ID from path
        docId = file
            .replace(/\.mdx?$/, '')
            .replace(/\/index$/, '')
            .replace(/\\/g, '/')
            // Remove number prefixes like "01-", "02-" etc
            .replace(/\/\d+-/g, '/')
            .replace(/^\d+-/, '');
    }
    
    fileIds.set(docId, file);
});

console.log('\n=== ANALYSIS ===');
console.log(`Total markdown files: ${allFiles.length}`);
console.log(`Total sidebar entries: ${allSidebarIds.length}`);
console.log(`Unique sidebar entries: ${new Set(allSidebarIds).size}`);

// Find orphaned pages
const orphans = [];
fileIds.forEach((file, id) => {
    if (!allSidebarIds.includes(id)) {
        orphans.push({ id, file });
    }
});

if (orphans.length > 0) {
    console.log('\n=== ORPHANED PAGES ===');
    console.log(`Found ${orphans.length} orphaned page(s):\n`);
    orphans.forEach(({ id, file }) => {
        console.log(`  - ${id}`);
        console.log(`    File: ${file}`);
    });
    process.exit(1);
} else {
    console.log('\n✓ No orphaned pages found!');
}

// Find sidebar entries without files
const missingFiles = [];
allSidebarIds.forEach(id => {
    if (!fileIds.has(id)) {
        missingFiles.push(id);
    }
});

if (missingFiles.length > 0) {
    console.log('\n=== SIDEBAR ENTRIES WITHOUT FILES ===');
    console.log(`Found ${missingFiles.length} sidebar entry(ies) without corresponding files:\n`);
    missingFiles.forEach(id => {
        console.log(`  - ${id}`);
    });
}
