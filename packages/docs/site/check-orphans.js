const fs = require('fs');
const path = require('path');

// Load the sidebars config
const sidebars = require('./sidebars.js');

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

console.log('Doc IDs in sidebars:', allSidebarIds.length);
console.log('Sidebar IDs:', JSON.stringify(allSidebarIds, null, 2));
