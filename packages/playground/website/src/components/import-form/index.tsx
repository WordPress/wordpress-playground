import { useRef } from 'react';
import type { PlaygroundClient } from '@wp-playground/playground-client';

import css from './style.module.css';
import { importFile } from '@wp-playground/playground-client';

interface ImportFormProps {
  playground: PlaygroundClient;
  onImported: () => void;
  onClose: () => void;
}

export default function ImportForm({
  playground,
  onImported,
  onClose,
}: ImportFormProps) {
  const form = useRef<any>();
  const fileInputRef = useRef<any>();
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string>('');
  function handleSelectFile(e) {
    setFile(e.target.files[0]);
  }
  function handleImportSelectFileClick(e) {
    e.preventDefault();
    form.current?.reset();
    fileInputRef.current?.click();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      return;
    }

    try {
      await importFile(playground, file);
    } catch (error) {
      setError(
        'Unable to import file. Is it a valid WordPress Playground export?'
      );
      return;
    }

    onImported();
  }

  return (
    <div className={css.modalInner}>
      <form id="import-playground-form" ref={form} onSubmit={handleSubmit}>
        <button
          id="import-close-modal--btn"
          onClick={onClose}
          className={`${css.btn} ${css.btnClose}`}
          aria-label="Close import window"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="32"
            height="32"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path>
          </svg>
        </button>
        <h2 tabIndex={0}>Import Playground</h2>
        <p className={css.modalText}>
          You may import a previously exported WordPress Playground instance
          here.
        </p>
        <p className={css.modalText}>
          <strong>Known Limitations</strong>
          <br />
          <ul className={css.modalTextList}>
            <li>Styling changes may take up to one minute to update.</li>
            <br />
            <li>
              Migrating between different WordPress versions is not supported.
            </li>
            <br />
            <li>
              Media files, options/users, and plugin state will not be included.
            </li>
          </ul>
        </p>
        <div className={css.inputsContainer}>
          <input
            type="file"
            id="import-select-file"
            onChange={handleSelectFile}
            style={{ display: 'none' }}
            ref={fileInputRef}
            accept="application/zip"
          />
          <label
            htmlFor="import-select-file"
            className={css.fileInputLabel}
            onClick={handleImportSelectFileClick}
          >
            <div id="import-select-file--text" className={css.fileInputText}>
              {error ? (
                <span className={css.error}>{error}</span>
              ) : file ? (
                file.name
              ) : (
                'No File Selected'
              )}
            </div>
            <button id="import-select-file--btn" className={css.btn}>
              Choose File
            </button>
          </label>
          <button id="import-submit--btn" className={css.btn} disabled={!file}>
            Import
          </button>
        </div>
      </form>
    </div>
  );
}
