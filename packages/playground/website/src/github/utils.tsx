
export function removeURLState() {
	// Remove ?state=github-xxx from the URL.
	const url = new URL(window.location.href);
	url.searchParams.delete('state');
	window.history.pushState({}, '', url.toString());
}

export function addURLState(name: string) {
	// Add a ?state=github-xxx to the URL so that the user can refresh the page
	// and still see the modal.
	const url = new URL(window.location.href);
	url.searchParams.set('state', name);
	window.history.pushState({}, '', url.toString());
}
