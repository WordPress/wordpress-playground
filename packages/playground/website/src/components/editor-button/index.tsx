import Modal from 'react-modal';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import css from './style.module.css';
import FilesExplorer from '../playground-viewport/FilesExplorer';
import CodeMirror, {CodeMirrorRef, MemFile} from '../playground-viewport/CodeMirror';
import {PlaygroundClient} from '@wp-playground/playground-remote';

Modal.setAppElement('#root');

interface EditorButtonProps {
  playground?: PlaygroundClient;
}

function debounce(func, timeout = 1000){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

export default function Editor({ playground }: EditorButtonProps) {
  const [isOpen, setOpen] = useState(false);
  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  const [counter, setCounter]= useState(0);

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

  const [initialFile, setInitialFile] = useState<MemFile | undefined>();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialFile || !playground) {
      setCounter((v) => v+1);
      return;
    }

    (async() => {
      setInitialFile({
        fileName: 'readme.html',
        contents: await playground?.readFileAsText('/wordpress/README.md') || '',
      });
    })();
  }, [isOpen, playground, initialFile]);

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
    <>
      <button
        id="import-open-modal--btn"
        className={css.btn}
        aria-label="Open Playground import window"
        onClick={openModal}
      >
        <svg style={{fill: '#fff'}} xmlns="http://www.w3.org/2000/svg" height="48" width="48"><path d="m18.95 30.85 2.2-2.2L16.5 24l4.6-4.6-2.2-2.2-6.8 6.8Zm10.1 0L35.9 24l-6.85-6.85-2.2 2.2L31.5 24l-4.65 4.65ZM9 42q-1.2 0-2.1-.9Q6 40.2 6 39V9q0-1.2.9-2.1Q7.8 6 9 6h30q1.2 0 2.1.9.9.9.9 2.1v30q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h30V9H9v30ZM9 9v30V9Z"/></svg>
      </button>
      <Modal
        isOpen={isOpen}
        contentLabel='This is a dialog window which overlays the main content of the page.'
        onRequestClose={closeModal}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: 1400,
            zIndex: 200,
            color: '#000',
            border: '#000 1px solid',
            borderRadius: '6px',
            background: '#fff',
          },
          overlay: {
            background: '#1e2327d0',
          },
        }}
      >
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
      </Modal>
    </>
  );
}
