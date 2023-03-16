import type { Plugin } from 'vite';
interface VirtualModuleOptions {
	name: string;
	content: string;
}
export default function virtualModule({
	name,
	content,
}: VirtualModuleOptions): Plugin {
	const virtualModuleId = `virtual:${name}`;
	const resolvedVirtualModuleId = '\0' + virtualModuleId;

	return {
		name: name, // required, will show up in warnings and errors
		resolveId(id) {
			if (id === virtualModuleId) {
				return resolvedVirtualModuleId;
			}
		},
		load(id) {
			if (id === resolvedVirtualModuleId) {
				return content;
			}
		},
	};
}
