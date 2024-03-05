if ('serviceWorker' in navigator)
	navigator.serviceWorker.register('/website-server/dev-sw.js?dev-sw', {
		scope: '/website-server/',
		type: 'module',
	});
