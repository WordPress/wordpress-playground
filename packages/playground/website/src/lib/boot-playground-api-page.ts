void bootPlaygroundAPIPage();

async function bootPlaygroundAPIPage() {
	if (window.self === window.top) {
		document.getElementById('api-description')!.hidden = false;
		return;
	}

	const { bootPlaygroundAPI } = await import('./boot-playground-api');
	Object.assign(window, { playgroundAPI: bootPlaygroundAPI() });
}
