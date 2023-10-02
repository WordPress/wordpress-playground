export const StorageTypes = ['browser', 'temporary', 'opfs-host'] as const;
export type StorageType = (typeof StorageTypes)[number];
