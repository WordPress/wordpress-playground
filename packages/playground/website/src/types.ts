export const StorageTypes = ['browser', 'device', 'none'] as const;
export type StorageType = (typeof StorageTypes)[number];
