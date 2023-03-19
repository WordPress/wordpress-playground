import { EditorView, basicSetup } from 'codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { linter, lintKeymap, lintGutter } from '@codemirror/lint';
import { darculaInit } from '@uiw/codemirror-theme-darcula';

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';

export type MemFile = {
  fileName: string;
  contents: string;
};

interface CodeMirrorProps {
  onChange: (updatedFile: MemFile) => void;
  initialFile?: MemFile;
  className?: string;
}

export type CodeMirrorRef = {
  setFile: (file: MemFile) => void;
};

export default React.forwardRef<CodeMirrorRef, CodeMirrorProps>(
  function CodeMirror({ onChange, initialFile, className = '' }, ref) {
    const codeMirrorRef = useRef(null);
    const [file, setFile] = useState<MemFile>(
      initialFile || {
        fileName: 'fake.js',
        contents: "console.log('hello world!');",
      }
    );

    useEffect(() => {
      if (initialFile) {
        setFile(initialFile)
      }
    }, [initialFile]);

    useImperativeHandle(ref, () => ({
      setFile,
    }));
    const view = useMemo(() => {
      if (!codeMirrorRef.current) {
        return null;
      }

      const extensions = {
        js: () => [javascript({ jsx: true })],
        ts: () => [
          javascript({ typescript: true, jsx: true }),
        ],
        jsx: () => [javascript({ jsx: true })],
        tsx: () => [
          javascript({ typescript: true, jsx: true }),
        ],
        json: () => [json(), linter(jsonParseLinter())],
        html: () => [html()],
        css: () => [css()],
        md: () => [markdown()],
        php: () => [php()],
      }

      const fileExtension = file.fileName.split('.').pop();
      const fileSpecificExtensions = ( fileExtension && Object.hasOwn(extensions, fileExtension) ) ? extensions[fileExtension]() : [];

      const themeOptions = EditorView.theme({
        '&': {
          height: '350px',
          width: '100%',
        },
      });

      const ourKeymap = keymap.of([
        {
          key: 'Mod-s',
          run() {
            return true;
          },
        },
        ...lintKeymap,
      ]);

      const updateListener = EditorView.updateListener.of(
        (vu: ViewUpdate) => {
          if (vu.docChanged && typeof onChange === 'function') {
            onChange({
              fileName: file.fileName,
              contents: vu.state.doc.toString(),
            });
          }
        }
      );

      const _view = new EditorView({
        doc: file.contents,
        extensions: [
          basicSetup,
          themeOptions,
          ourKeymap,
          ...fileSpecificExtensions,
          lintGutter(),
          updateListener,
          darculaInit(),
        ],
        parent: codeMirrorRef.current,
      });

      return _view;
    }, [file.fileName, file.contents, onChange, codeMirrorRef.current]);

    useEffect(() => {
      // return a function to be executed at component unmount
      return () => {
        view && view.destroy()
      };
    }, [view]);

    return <div ref={codeMirrorRef} className={className} />;
  }
);
