export default function isReactRefreshBoundary(Refresh, moduleExports) {
	if (Refresh.isLikelyComponentType(moduleExports)) {
		return true;
	}
	if (moduleExports == null || typeof moduleExports !== 'object') {
		// Exit if we can't iterate over exports.
		return false;
	}
	let hasExports = false;
	let areAllExportsComponents = true;
	for (const key in moduleExports) {
		hasExports = true;
		if (key === '__esModule') {
			continue;
		}
		const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
		if (desc && desc.get) {
			// Don't invoke getters as they may have side effects.
			return false;
		}
		const exportValue = moduleExports[key];
		if (!Refresh.isLikelyComponentType(exportValue)) {
			areAllExportsComponents = false;
		}
	}
	return hasExports && areAllExportsComponents;
}
