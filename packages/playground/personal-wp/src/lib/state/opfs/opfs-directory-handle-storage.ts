let db: IDBDatabase;
export function getIndexedDB() {
	return new Promise<IDBDatabase>((resolve, reject) => {
		if (db) {
			resolve(db);
			return;
		}
		const openRequest = indexedDB.open('fileSystemDB', 1);

		openRequest.onupgradeneeded = function (e: any) {
			db = e.target.result;
			if (!db.objectStoreNames.contains('fileSystemStore')) {
				db.createObjectStore('fileSystemStore');
			}
		};

		openRequest.onsuccess = function (e: any) {
			db = e.target.result;
			resolve(db);
		};

		openRequest.onerror = reject;
	});
}

// Function to save directory handle to IndexedDB
export async function saveDirectoryHandle(
	siteSlug: string,
	directoryHandle: FileSystemDirectoryHandle
) {
	const db = await getIndexedDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(['fileSystemStore'], 'readwrite');
		const store = tx.objectStore('fileSystemStore');
		store.put(directoryHandle, siteSlug);
		tx.oncomplete = resolve;
		tx.onerror = reject;
	});
}

// Function to retrieve directory handle from IndexedDB
export async function loadDirectoryHandle(siteSlug: string) {
	const db = await getIndexedDB();
	return new Promise<FileSystemDirectoryHandle>((resolve, reject) => {
		const tx = db.transaction(['fileSystemStore'], 'readonly');
		const store = tx.objectStore('fileSystemStore');
		const handleDataRequest = store.get(siteSlug);
		handleDataRequest.onsuccess = async function () {
			// If there's data to retrieve, convert it back to a handle
			if (!handleDataRequest.result) {
				reject(
					'Directory handle not found in IndexedDB for site ' +
						siteSlug
				);
			}
			resolve(handleDataRequest.result);
		};

		handleDataRequest.onerror = reject;
	});
}
