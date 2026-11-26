/** Release IDs become URL and directory names; keep the same rule as the installer. */
export function isValidReleaseId(id: string): boolean {
	return /^[A-Za-z0-9]/.test(id) && !/[^A-Za-z0-9._-]/.test(id);
}
