<?php
/**
 * Overrides HTMLIFrameElement.prototype.srcDoc and .src setters so that
 * iframes created with srcDoc or blob: URLs are redirected through
 * /wp-includes/empty.html#<content>. This ensures the iframe inherits
 * the service worker and can load assets correctly.
 *
 * Injected at priority 0 so it runs before any script that creates iframes.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/42
 */

function playground_iframe_fix() {
	?>
	<script>
	(function() {
		var srcDescriptor = Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype, 'src'
		);
		var srcDocDescriptor = Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype, 'srcDoc'
		);
		if (!srcDescriptor || !srcDocDescriptor) return;

		var lastWritten = new WeakMap();

		function readBlobAsText(url) {
			try {
				var xhr = new XMLHttpRequest();
				xhr.open('GET', url, false);
				xhr.overrideMimeType('text/plain;charset=utf-8');
				xhr.send();
				return xhr.responseText;
			} catch(e) {
				return '';
			}
		}

		Object.defineProperty(HTMLIFrameElement.prototype, 'srcDoc', {
			configurable: true,
			enumerable: true,
			get: function() {
				return lastWritten.get(this) || '';
			},
			set: function(value) {
				var prev = lastWritten.get(this);
				if (prev === value) return;
				lastWritten.set(this, value);
				srcDescriptor.set.call(
					this,
					'/wp-includes/empty.html#' +
						encodeURIComponent(value)
				);
			}
		});

		Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
			configurable: true,
			enumerable: true,
			get: function() {
				return srcDescriptor.get.call(this);
			},
			set: function(value) {
				if (typeof value === 'string' &&
					value.startsWith('blob:')) {
					var content = readBlobAsText(value);
					var prev = lastWritten.get(this);
					if (prev === content) return;
					lastWritten.set(this, content);
					srcDescriptor.set.call(
						this,
						'/wp-includes/empty.html#' +
							encodeURIComponent(content)
					);
				} else {
					srcDescriptor.set.call(this, value);
				}
			}
		});
	})();
	</script>
	<?php
}
add_action('wp_head', 'playground_iframe_fix', 0);
add_action('admin_head', 'playground_iframe_fix', 0);
