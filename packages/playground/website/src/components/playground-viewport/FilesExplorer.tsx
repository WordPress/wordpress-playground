import React, {useEffect, useState} from 'react';
import { useCallback, useMemo } from 'react';
import { Tree } from '@geist-ui/core';

const noop = () => {};

type MaybePromise<T> = Promise<T> | T;
interface FileSystem {
  /**
   * Lists the files and directories in the given directory.
   *
   * @param  path - The directory path to list.
   * @returns The list of files and directories in the given directory.
   */
  listFiles(path: string): MaybePromise<string[]>;

  /**
   * Checks if a directory exists in the filesystem.
   *
   * @param path – The path to check.
   * @returns True if the path is a directory, false otherwise.
   */
  isDir(path: string): MaybePromise<boolean>;
}
interface FilesExplorerProps {
  chroot?: string;
  onSelectFile?: (path: string) => void;
  fileSystem: FileSystem;
  className?: string;
}

function useDeferredValue(promise: Promise<unknown>) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    promise.then(setValue)
  }, [promise])
  return value
}

function pathJoin(...parts: string[]) {
  return parts.join('/').replace(/\/+/g, '/');
}

export default function FilesExplorer({
                                        chroot = '/',
                                        onSelectFile = noop,
                                        fileSystem,
                                        className = '',
                                      }: FilesExplorerProps) {
  const onClick = useCallback((file: string) => {
    onSelectFile(pathJoin(chroot, file));
  }, [chroot, onSelectFile]);

  const treePromise = useTreeComponents(fileSystem, chroot);
  const tree = useDeferredValue(treePromise) as any;

  return (
    <Tree onClick={onClick} className={className}>
      {tree}
    </Tree>
  );
}

async function useTreeComponents(
  fileSystem: FileSystem,
  chroot: string
): Promise<any> {
  return useMemo(() => {
    return buildTreeComponents(fileSystem, chroot);
  }, [fileSystem, chroot]);
}

async function buildTreeComponents(fileSystem: FileSystem, chroot: string) {
  if (!fileSystem) {
    return [];
  }

  const files = await fileSystem.listFiles(chroot);

  return await Promise.all(
    files.map(async (file) => {
      const path = pathJoin(chroot, file);
      const isDir = await fileSystem.isDir(path);
      if (isDir) {
        return (
          <Tree.Folder name={file} key={file}>
            {(await buildTreeComponents(fileSystem, path)) as any}
          </Tree.Folder>
        );
      } else {
        return <Tree.File name={file} key={file} />;
      }
    })
  );
}
