export const StorageTypes = ['opfs-browser', 'temporary', 'opfs-host'] as const;
export type StorageType = (typeof StorageTypes)[number];
