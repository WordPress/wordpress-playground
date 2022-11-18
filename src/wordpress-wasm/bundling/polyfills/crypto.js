// Facebook's react-refresh/babel does this:
//     finalKey = require('crypto').createHash('sha1').update(key).digest('base64');
// We don't have a crypto module in the browser, so we need to polyfill it.

export function createHash(alg) {
	const data = [];
	return {
		update: function (part) {
			data.push(part);
			return this;
		},
		digest(encoding) {
			// We are cheating and computing the CRC32 of the string
			// instead of the actual sha1.
			return btoa(crc32(data.join('')));
		},
	};
}

function crc32(string) {
	for (var a, o = [], c = 0; c < 256; c++) {
		a = c;
		for (var f = 0; f < 8; f++)
			a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
		o[c] = a;
	}
	for (var n = -1, t = 0; t < string.length; t++)
		n = (n >>> 8) ^ o[255 & (n ^ string.charCodeAt(t))];
	return (-1 ^ n) >>> 0;
}
