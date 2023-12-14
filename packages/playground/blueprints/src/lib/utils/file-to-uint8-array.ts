export async function fileToUint8Array(file: File) {
	return new Uint8Array(await file.arrayBuffer());
}
