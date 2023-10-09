/**
 * A synchronous function to read a blob URL as text.
 * 
 * @param {string} url 
 * @returns {string}
 */
const __playground_readBlobAsText = function (url) {
	try {
	  let xhr = new XMLHttpRequest();
	  xhr.open('GET', url, false);
	  xhr.overrideMimeType('text/plain;charset=utf-8');
	  xhr.send();
	  return xhr.responseText;
	} catch(e) {
	  return '';
	} finally {
	  URL.revokeObjectURL(url);
	}
}

window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
    const source = window.wp.element.useMemo(function () {
        if (props.srcDoc) {
            // WordPress <= 6.2 uses a srcDoc that only contains a doctype.
            return '/wp-includes/empty.html';
        } else if (props.src && props.src.startsWith('blob:')) {
            // WordPress 6.3 uses a blob URL with doctype and a list of static assets.
            // Let's pass the document content to empty.html and render it there.
            return '/wp-includes/empty.html#' + encodeURIComponent(__playground_readBlobAsText(props.src));
        } else {
            // WordPress >= 6.4 uses a plain HTTPS URL that needs no correction.
            return props.src;
        }
    }, [props.src]);
	return (
		window.wp.element.createElement('iframe', {
			...props,
			ref: ref,
            src: source,
            // Make sure there's no srcDoc, as it would interfere with the src.
            srcDoc: undefined
		})
	)
});