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

// Function to get the doc ID for a file
function getDocId(file) {
    const fullPath = path.join(docsDir, file);
    const fm = getFrontmatter(fullPath);
    
    if (fm && fm.id) {
        // If there's an explicit ID in frontmatter, use it with the directory prefix
        const dir = path.dirname(file);
        if (dir !== '.') {
            const topLevel = dir.split(path.sep)[0];
            return `${topLevel}/${fm.id}`;
        }
        return fm.id;
    }
    
    // Otherwise, use the file path as the ID (Docusaurus default behavior)
    // Remove the file extension and convert to forward slashes
    let id = file
        .replace(/\.mdx?$/, '')
        .replace(/\\/g, '/');
    
    // Remove number prefixes (e.g., "01-", "23-")
    id = id.replace(/\/\d+-/g, '/').replace(/^\d+-/, '');
    
    // If the file is named "index", the ID is the directory path
    // But if it's "intro", it might be referenced differently in the sidebar
    
    return id;
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
const fileIdMap = new Map(); // Map from doc ID to file path

allFiles.forEach(file => {
    const docId = getDocId(file);
    fileIdMap.set(docId, file);
});

console.log('\n=== ANALYSIS ===');
console.log(`Total markdown files: ${allFiles.length}`);
console.log(`Total sidebar entries: ${allSidebarIds.length}`);
console.log(`Unique sidebar entries: ${new Set(allSidebarIds).size}`);

// Check if there are any duplicate sidebar entries
const duplicates = allSidebarIds.filter((id, index) => allSidebarIds.indexOf(id) !== index);
if (duplicates.length > 0) {
    console.log(`\nWarning: Found ${duplicates.length} duplicate sidebar entry(ies):`);
    new Set(duplicates).forEach(id => console.log(`  - ${id}`));
}

// Find orphaned pages
const orphans = [];
fileIdMap.forEach((file, id) => {
    if (!allSidebarIds.includes(id)) {
        orphans.push({ id, file });
    }
});

if (orphans.length > 0) {
    console.log('\n=== ORPHANED PAGES (NOT IN SIDEBARS) ===');
    console.log(`Found ${orphans.length} orphaned page(s):\n`);
    orphans.forEach(({ id, file }) => {
        console.log(`  ID: ${id}`);
        console.log(`  File: ${file}\n`);
    });
    process.exit(1);
} else {
    console.log('\n✓ All pages are linked in sidebars!');
}

// Find sidebar entries without files
const missingFiles = [];
allSidebarIds.forEach(id => {
    if (!fileIdMap.has(id)) {
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
