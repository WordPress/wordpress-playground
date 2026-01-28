#!/usr/bin/env node
/**
 * Script to automatically update translation tracker issues with current progress.
 * 
 * This script:
 * 1. Scans source documentation files
 * 2. Checks which files have been translated for each language
 * 3. Updates the corresponding GitHub issue with current progress
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const REPO_OWNER = 'WordPress';
const REPO_NAME = 'wordpress-playground';
const DOCS_DIR = path.join(__dirname, '../../packages/docs/site/docs');
const I18N_DIR = path.join(__dirname, '../../packages/docs/site/i18n');

// Translation tracker issues mapping: locale -> issue number
const TRACKER_ISSUES = {
    'bn': 3186,        // Bengali
    'fr': 2621,        // French
    'tl': 2353,        // Tagalog
    'pt-BR': 2306,     // Brazilian Portuguese
    'gu': 2320         // Gujarati
};

/**
 * Get all markdown files in a directory recursively
 */
function getAllMarkdownFiles(dir, baseDir = dir) {
    let files = [];
    
    if (!fs.existsSync(dir)) {
        return files;
    }
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        // Skip hidden and fragment directories
        if (item.name.startsWith('_') || item.name.startsWith('.')) {
            continue;
        }
        
        if (item.isDirectory()) {
            files = files.concat(getAllMarkdownFiles(fullPath, baseDir));
        } else if (item.isFile() && item.name.endsWith('.md')) {
            files.push(path.relative(baseDir, fullPath));
        }
    }
    
    return files.sort();
}

/**
 * Organize files by category (main, blueprints, developers)
 */
function organizeFilesByCategory(files) {
    const categories = {
        main: {},
        blueprints: {},
        developers: {}
    };
    
    for (const file of files) {
        const parts = file.split(path.sep);
        const category = parts[0];
        
        if (category === 'main') {
            addToTree(categories.main, parts.slice(1), file);
        } else if (category === 'blueprints') {
            addToTree(categories.blueprints, parts.slice(1), file);
        } else if (category === 'developers') {
            addToTree(categories.developers, parts.slice(1), file);
        }
    }
    
    return categories;
}

/**
 * Add a file to a tree structure
 */
function addToTree(tree, parts, fullPath) {
    if (parts.length === 1) {
        // It's a file
        if (!tree._files) tree._files = [];
        tree._files.push({ name: parts[0], path: fullPath });
    } else {
        // It's a directory
        const dir = parts[0];
        if (!tree[dir]) tree[dir] = {};
        addToTree(tree[dir], parts.slice(1), fullPath);
    }
}

/**
 * Generate markdown checklist from file tree
 */
function generateChecklist(tree, translatedSet, indent = 0, parentPath = '') {
    let output = '';
    const indentStr = '  '.repeat(indent);
    
    // Get directories and files
    const dirs = Object.keys(tree).filter(k => !k.startsWith('_')).sort();
    const files = tree._files || [];
    
    // Process directories first
    for (const dir of dirs) {
        output += `${indentStr}- ${dir}\n`;
        output += generateChecklist(tree[dir], translatedSet, indent + 1, path.join(parentPath, dir));
    }
    
    // Process files
    for (const file of files) {
        const checked = translatedSet.has(file.path) ? 'x' : ' ';
        output += `${indentStr}- [${checked}] ${file.name}\n`;
    }
    
    return output;
}

/**
 * Generate the full issue body with translation progress
 */
function generateIssueBody(locale, localeName, translatedFiles, sourceCategories) {
    const translatedSet = new Set(translatedFiles);
    
    // Calculate completion stats
    const totalFiles = Object.values(sourceCategories).reduce((sum, cat) => {
        return sum + countFiles(cat);
    }, 0);
    const translatedCount = translatedFiles.length;
    const percentage = Math.round((translatedCount / totalFiles) * 100);
    
    // Generate issue body
    let body = `This issue tracks the progress of translating the WordPress Playground Documentation into ${localeName}.\n\n`;
    body += `**Progress: ${translatedCount}/${totalFiles} files (${percentage}%)**\n\n`;
    body += `**${localeName} Playground Documentation**\n`;
    body += `https://wordpress.github.io/wordpress-playground/${locale}/\n\n`;
    body += `**How to translate (${localeName})**\n`;
    body += `https://wordpress.github.io/wordpress-playground/${locale}/contributing/translations/\n\n`;
    body += `**Translation Method**\n`;
    body += `We follow the custom of leaving the original text commented out and translating it immediately afterwards.\n\n`;
    body += `## Remaining translation pages\n\n`;
    
    // Main section
    body += `<details open>\n`;
    body += `<summary><h3>Main</h3></summary>\n\n`;
    body += generateChecklist(sourceCategories.main, translatedSet);
    body += `\n</details>\n\n`;
    
    // Blueprints section
    body += `<details open>\n`;
    body += `<summary><h3>Blueprints</h3></summary>\n\n`;
    body += generateChecklist(sourceCategories.blueprints, translatedSet);
    body += `\n</details>\n\n`;
    
    // Developers section
    body += `<details open>\n`;
    body += `<summary><h3>Developers</h3></summary>\n\n`;
    body += generateChecklist(sourceCategories.developers, translatedSet);
    body += `\n</details>\n`;
    
    return body;
}

/**
 * Count total files in a category tree
 */
function countFiles(tree) {
    let count = 0;
    
    if (tree._files) {
        count += tree._files.length;
    }
    
    for (const key of Object.keys(tree)) {
        if (!key.startsWith('_') && typeof tree[key] === 'object') {
            count += countFiles(tree[key]);
        }
    }
    
    return count;
}

/**
 * Make a GitHub API request
 */
function githubRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: method,
            headers: {
                'User-Agent': 'WordPress-Playground-Translation-Bot',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${process.env.GITHUB_TOKEN}`
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body || '{}'));
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode} ${body}`));
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * Update a GitHub issue with new body content
 */
async function updateIssue(issueNumber, body) {
    const endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`;
    await githubRequest('PATCH', endpoint, { body });
    console.log(`✓ Updated issue #${issueNumber}`);
}

/**
 * Get locale display name
 */
function getLocaleDisplayName(locale) {
    const names = {
        'bn': 'Bengali',
        'fr': 'French',
        'tl': 'Tagalog',
        'pt-BR': 'Brazilian Portuguese',
        'gu': 'Gujarati'
    };
    return names[locale] || locale;
}

/**
 * Main function
 */
async function main() {
    console.log('Scanning source documentation files...');
    const sourceFiles = getAllMarkdownFiles(DOCS_DIR);
    console.log(`Found ${sourceFiles.length} source files`);
    
    const sourceCategories = organizeFilesByCategory(sourceFiles);
    
    console.log('\nProcessing translations for each locale...\n');
    
    for (const [locale, issueNumber] of Object.entries(TRACKER_ISSUES)) {
        console.log(`Processing ${locale}...`);
        
        const localeDir = path.join(I18N_DIR, locale, 'docusaurus-plugin-content-docs', 'current');
        const translatedFiles = getAllMarkdownFiles(localeDir);
        
        console.log(`  - Found ${translatedFiles.length} translated files`);
        
        const localeName = getLocaleDisplayName(locale);
        const issueBody = generateIssueBody(locale, localeName, translatedFiles, sourceCategories);
        
        try {
            await updateIssue(issueNumber, issueBody);
        } catch (error) {
            console.error(`  ✗ Failed to update issue #${issueNumber}:`, error.message);
        }
        
        console.log('');
    }
    
    console.log('Done!');
}

// Run if executed directly
if (require.main === module) {
    if (!process.env.GITHUB_TOKEN) {
        console.error('Error: GITHUB_TOKEN environment variable is required');
        process.exit(1);
    }
    
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
