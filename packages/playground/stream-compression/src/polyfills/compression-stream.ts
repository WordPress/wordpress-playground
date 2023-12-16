class DeflateCompressionStream extends CompressionStream {
	private withoutHeaders: any;
	constructor(format: CompressionFormat) {
		console.log('A');
		let simulateDeflateRaw = false;
		if (format === 'deflate-raw') {
			format = 'deflate';
			simulateDeflateRaw = true;
		}
		super(format);
		if (simulateDeflateRaw) {
			const readable = this.readable;
			this.withoutHeaders = new TransformStream({
				async start() {
					const reader = readable.getReader({ mode: 'byob' });
					// Skip the header
					reader.read(new Uint32Array(32));
					reader.releaseLock();
				},
			});
			readable.pipeTo(this.withoutHeaders.writable);
		}
	}

	// override get readable() {
	// 	return this.withoutHeaders.readable || super.readable;
	// }
}

global.CompressionStream = DeflateCompressionStream;
