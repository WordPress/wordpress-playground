// Shim the browser's file class
export class File {
	data;
	name;

	constructor(data, name) {
		this.data = data;
		this.name = name;
	}

	get size() {
		return this.data.length;
	}

	get type() {
		return 'text/plain';
	}

	arrayBuffer() {
		return new ArrayBuffer(toUint8Array(this.data));
	}
}

function toUint8Array(data) {
	if (typeof data === 'string') {
		return new TextEncoder().encode(data).buffer;
	} else if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	} else if (Array.isArray(data)) {
		if (data[0] instanceof Number) {
			return new Uint8Array(data);
		}
		return toUint8Array(data[0]);
	} else if (data instanceof Uint8Array) {
		return data.buffer;
	} else {
		throw new Error('Unsupported data type');
	}
}
