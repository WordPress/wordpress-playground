export const CustomEvent =
	globalThis.CustomEvent ??
	class extends globalThis.Event {
		detail = null;
		constructor(
			name: string,
			options: {
				detail?: any;
				bubbles?: boolean;
				cancellable?: boolean;
				composed?: boolean;
			} = {}
		) {
			super(name, options);
			this.detail = options.detail;
		}
	};
