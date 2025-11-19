#!/usr/bin/env node

/**
 * Check for orphaned documentation pages
 *
 * This script verifies that all Docusaurus documentation pages are linked
 * in at least one sidebar menu. Orphaned pages (pages not linked anywhere)
 * may be forgotten or unintentionally excluded from the documentation.
 *
 * Exit codes:
 * - 0: Success, no orphaned pages found
 * - 1: Failure, orphaned pages were found
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const SITE_DIR = path.join(SCRIPT_DIR, '..');
const DOCS_DIR = path.join(SITE_DIR, 'docs');
const SIDEBARS_PATH = path.join(SITE_DIR, 'sidebars.js');
const INTENTIONAL_ORPHAN_FLAG = 'orphan';

/**
 * Extract frontmatter from a markdown file
 */
function getFrontmatter(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return null;

	const frontmatter = {};
	const lines = match[1].split('\n');
	for (const line of lines) {
		const [key, ...valueParts] = line.split(':');
		if (key && valueParts.length) {
			const rawValue = valueParts.join(':').trim();
			let parsedValue = rawValue;
			if (/^(true|false)$/i.test(rawValue)) {
				parsedValue = rawValue.toLowerCase() === 'true';
			} else if (/^['\"].*['\"]$/.test(rawValue)) {
				parsedValue = rawValue.slice(1, -1);
			}
			frontmatter[key.trim()] = parsedValue;
		}
	}
	return frontmatter;
}

/**
 * Recursively find all markdown files in a directory
 */
function getAllMarkdownFiles(dir, baseDir = dir) {
	let files = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// Skip _fragments directory - these are partial files included elsewhere
			if (entry.name === '_fragments') continue;
			files = files.concat(getAllMarkdownFiles(fullPath, baseDir));
		} else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
			const relativePath = path.relative(baseDir, fullPath);
			files.push(relativePath);
		}
	}
	return files;
}

/**
 * Get the Docusaurus document ID for a file
 * Follows Docusaurus conventions:
 * - If frontmatter has an 'id' field, use it (prefixed with parent directory path)
 * - Otherwise, derive from file path (without extension, with number prefixes removed)
 */
function getDocId(file, frontmatter = null) {
	const fullPath = path.join(DOCS_DIR, file);
	const fm = frontmatter ?? getFrontmatter(fullPath);

	if (fm && fm.id) {
		// If there's an explicit ID in frontmatter, use it with the directory prefix
		const dir = path.dirname(file);
		if (dir !== '.') {
			// Use the full directory path, not just the top level
			const dirPath = dir.replace(/\\/g, '/');
			return `${dirPath}/${fm.id}`;
		}
		return fm.id;
	}

	// Otherwise, use the file path as the ID (Docusaurus default behavior)
	let id = file
		.replace(/\.mdx?$/, '') // Remove file extension
		.replace(/\\/g, '/'); // Convert to forward slashes

	// Remove number prefixes (e.g., "01-", "23-") that are used for ordering
	id = id.replace(/\/\d+-/g, '/').replace(/^\d+-/, '');

	return id;
}

/**
 * Determine if a document has opted-in to being an intentional orphan
 */
function isIntentionallyOrphaned(frontmatter) {
	if (!frontmatter || typeof frontmatter !== 'object') {
		return false;
	}

	const flagValue = frontmatter[INTENTIONAL_ORPHAN_FLAG];
	if (typeof flagValue === 'boolean') {
		return flagValue;
	}
	if (typeof flagValue === 'string') {
		return flagValue.toLowerCase() === 'true';
	}
	return false;
}

/**
 * Recursively extract all document IDs referenced in sidebar configuration
 */
function extractDocIds(items) {
	let ids = [];
	for (const item of items) {
		if (typeof item === 'string') {
			// Simple string reference to a doc
			ids.push(item);
		} else if (item.type === 'category') {
			// Category with optional link
			if (item.link && item.link.id) {
				ids.push(item.link.id);
			}
			// Recursively process category items
			if (item.items) {
				ids = ids.concat(extractDocIds(item.items));
			}
		} else if (item.type === 'doc' && item.id) {
			// Explicit doc reference
			ids.push(item.id);
		}
	}
	return ids;
}

/**
 * Main function
 */
function main() {
	// Load the sidebars configuration
	const sidebars = require(SIDEBARS_PATH);

	// Extract all doc IDs from all sidebars
	let allSidebarIds = [];
	for (const sidebarKey in sidebars) {
		allSidebarIds = allSidebarIds.concat(
			extractDocIds(sidebars[sidebarKey])
		);
	}

	// Get all markdown files and their IDs
	const allFiles = getAllMarkdownFiles(DOCS_DIR);
	const fileIdMap = new Map();

	allFiles.forEach((file) => {
		const fullPath = path.join(DOCS_DIR, file);
		const frontmatter = getFrontmatter(fullPath) || {};
		const docId = getDocId(file, frontmatter);
		const allowsOrphan = isIntentionallyOrphaned(frontmatter);

		fileIdMap.set(docId, { file, allowsOrphan });
	});

	console.log('\n=== Documentation Link Check ===');
	console.log(`Total documentation files: ${allFiles.length}`);
	console.log(`Total sidebar entries: ${allSidebarIds.length}`);
	console.log(`Unique sidebar entries: ${new Set(allSidebarIds).size}`);

	// Check for duplicate sidebar entries
	const duplicates = allSidebarIds.filter(
		(id, index) => allSidebarIds.indexOf(id) !== index
	);
	if (duplicates.length > 0) {
		console.log(
			`\n⚠️  Warning: Found ${duplicates.length} duplicate sidebar entry(ies):`
		);
		new Set(duplicates).forEach((id) => console.log(`  - ${id}`));
	}

	// Find orphaned pages (files not referenced in any sidebar)
	const orphans = [];
	const intentionallyOrphaned = [];
	fileIdMap.forEach(({ file, allowsOrphan }, id) => {
		if (!allSidebarIds.includes(id)) {
			if (allowsOrphan) {
				intentionallyOrphaned.push({ id, file });
			} else {
				orphans.push({ id, file });
			}
		}
	});

	if (intentionallyOrphaned.length > 0) {
		console.log(
			`\nℹ️  ${intentionallyOrphaned.length} intentionally orphaned documentation page(s) (marked with 'orphan: true'):`
		);
		intentionallyOrphaned.forEach(({ id, file }) => {
			console.log(`  ID: ${id}`);
			console.log(`  File: ${file}\n`);
		});
	}

	if (orphans.length > 0) {
		console.log('\n❌ ORPHANED PAGES FOUND');
		console.log(
			`Found ${orphans.length} documentation page(s) not linked in any sidebar:\n`
		);
		orphans.forEach(({ id, file }) => {
			console.log(`  ID: ${id}`);
			console.log(`  File: ${file}\n`);
		});
		console.log(
			'Please add these pages to the appropriate sidebar in sidebars.js'
		);
		console.log(
			"or remove them if they are no longer needed. If a page should stay unlisted, add 'orphan: true' to its frontmatter.\n"
		);
		process.exit(1);
	}

	console.log(
		'\n✓ All documentation pages are linked in sidebars or intentionally marked as orphaned!'
	);

	// Find sidebar entries without corresponding files
	const missingFiles = [];
	allSidebarIds.forEach((id) => {
		if (!fileIdMap.has(id)) {
			missingFiles.push(id);
		}
	});

	if (missingFiles.length > 0) {
		console.log('\n⚠️  Warning: Sidebar entries without files');
		console.log(
			`Found ${missingFiles.length} sidebar entry(ies) without corresponding files:\n`
		);
		missingFiles.forEach((id) => {
			console.log(`  - ${id}`);
		});
		console.log('\nThese entries may cause broken links. Please verify.\n');
	}

	process.exit(0);
}

// Run the script
if (require.main === module) {
	main();
}

module.exports = { getDocId, extractDocIds, getAllMarkdownFiles };
