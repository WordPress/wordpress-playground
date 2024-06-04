# Mount data

## Mount a directory from the browser

You can mount a directory from the browser to Playground using the `window.showDirectoryPicker` API. Check the [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility) before using this API.

```javascript
window.showDirectoryPicker().then(function (directoryHandle) {
	window.parent.postMessage({
		type: 'mount-directory-handle',
		directoryHandle,
		mountpoint: '/wordpress/wp-content/uploads/markdown/',
	});
});
```
