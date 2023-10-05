export const StorageTypes = ['browser', 'device', 'temporary', 'opfs-host', 'opfs-browser'] as const;
export type StorageType = (typeof StorageTypes)[number];
