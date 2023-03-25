import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import css from './style.module.css';
import FilesExplorer from '../playground-viewport/FilesExplorer';
import CodeMirror, {CodeMirrorRef, MemFile} from '../playground-viewport/CodeMirror';
import {usePlayground, useProgressObserver} from '../../lib/hooks';
import { setupPlayground } from '../../lib/setup-playground';

function debounce(func, timeout = 1000){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Reload the page when the connection to the playground times out in the dev mode.
// There's a chance website server was booted faster than the playground server.
// @ts-ignore
const onConnectionTimeout = import.meta.env.DEV
  ? undefined // () => window.location.reload()
  : undefined;

export default function Editor() {
  const { observer } = useProgressObserver();
  const { playground } = usePlayground({
    async onConnected(api) {
      await setupPlayground(api, observer);
    },
    onConnectionTimeout,
  });

  const editorRef = useRef<CodeMirrorRef>(null);
  const [editedFile, setEditedFile] = useState<string | undefined>();

  const onFileChange = useMemo(
    () =>
    {
      return debounce(async ({ fileName, contents }) => {
        if (!playground) {
          return;
        }
        await playground.writeFile(fileName, contents);
        await playground.writeFile(fileName.replace('/src/', '/build/'), contents);
        console.log('writeFile', fileName);
      });
    },
    [playground]
  );

  console.log(playground);

  const [initialFile, setInitialFile] = useState<MemFile | undefined>();

  useEffect(() => {
    if (initialFile || !playground) {
      return;
    }

    (async() => {
      setInitialFile({
        fileName: 'readme.html',
        contents: await playground?.readFileAsText('/wordpress/README.md') || '',
      });
    })();
  }, [playground, initialFile]);

  const selectFile = useCallback(
    (fileName: string) => {
      setEditedFile(fileName);
      playground?.readFileAsText(fileName).then((contents) =>
        editorRef.current!.setFile({
          fileName,
          contents,
        })
      );
    },
    [playground]
  );

  return (
      <div className={css.editor}>
          <FilesExplorer
            chroot={'/wordpress'}
            fileSystem={playground!}
            onSelectFile={selectFile}
            className="ide-panel is-files-explorer"
          />
          <CodeMirror
            onChange={onFileChange}
            ref={editorRef}
            className="ide-panel is-code-mirror"
            initialFile={initialFile}
          />
      </div>
  );
}
