export const StorageTypes = ['browser', 'temporary', 'opfs-host', 'opfs-browser'] as const;
export type StorageType = (typeof StorageTypes)[number];
