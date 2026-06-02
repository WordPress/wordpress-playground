/**
 * DevTools page script - creates the Playground panel in Chrome DevTools.
 */
chrome.devtools.panels.create(
	'Playground',
	'icons/icon-16.png',
	'panel/index.html'
);
