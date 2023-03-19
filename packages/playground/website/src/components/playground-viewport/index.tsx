import type { PlaygroundClient } from '@wp-playground/client';

import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import React, {ReactElement, Ref, useMemo, Fragment, useRef, useEffect, useState, useCallback} from 'react';
import type {
	ProgressObserver,
	ProgressObserverEvent,
} from '@php-wasm/progress';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import ProgressBar from '../progress-bar';
import { usePlayground, useProgressObserver } from '../../lib/hooks';
import FilesExplorer from './FilesExplorer';
import CodeMirror, {MemFile} from './CodeMirror';
import type { CodeMirrorRef } from './CodeMirror';

interface PlaygroundViewportProps {
	isSeamless?: boolean;
	setupPlayground: (
		playground: PlaygroundClient,
		observer: ProgressObserver
	) => Promise<void>;
	toolbarButtons?: React.ReactElement[];
}

// Reload the page when the connection to the playground times out in the dev mode.
// There's a chance website server was booted faster than the playground server.
// @ts-ignore
const onConnectionTimeout = import.meta.env.DEV
	? undefined // () => window.location.reload()
	: undefined;

export default function PlaygroundViewport({
	isSeamless,
	setupPlayground,
	toolbarButtons,
}: PlaygroundViewportProps) {
	const { observer, progress } = useProgressObserver();
	const { playground, url, iframeRef } = usePlayground({
		async onConnected(api) {
			await setupPlayground(api, observer);
		},
		onConnectionTimeout,
	});

	const updatedToolbarButtons = useMemo(() => {
		if (isSeamless || !playground || !toolbarButtons?.length) {
			return;
		}
		return toolbarButtons.map((button, index) =>
			React.cloneElement(button as React.ReactElement, {
				key: index,
				playground,
			})
		) as ReactElement[];
	}, [isSeamless, playground, toolbarButtons]);

  const terminalContainer = useRef<HTMLDivElement>();
  const terminalRef = useRef<Terminal>();

  const isRunningCommand = useRef<boolean>(false);

  async function runCommand(command: string) {
    isRunningCommand.current = true;

    const args = command.split(' ');
    const cmd = args.shift();

    switch (cmd) {
      case 'ls':
        // TODO:
        (await playground?.listFiles(args[0] || '/') || []).forEach(line => {
          terminalRef.current?.writeln(line);
        });
        break;
      case 'clear':
        terminalRef.current?.clear();
        break;
      case 'cat':
        let file = await playground?.readFileAsText(args[0]);
        terminalRef.current?.writeln(file);
        break;

      case 'php':
        if (playground && args.length > 2) {
          if (args[0] === '-r') {
            const output = await playground.run({
              code: `<?php ${args.slice(1, args.length).join(' ')} ?>`,
            });
            const text = new TextDecoder().decode(output.body);
            (text.split('\n')).forEach(line => {
              terminalRef.current?.writeln(line);
            });
          }
        }
        break;

      case 'wp':
        if ( playground) {

          const wpCliArgs = args.map(arg => `"${arg.replaceAll('"', '\\"')}",`)

          await playground?.writeFile('/tmp/stdout', '');
          await playground?.writeFile('/tmp/stderror', '');
          await playground?.writeFile('/wordpress/run-cli.php',
            `<?php
            $GLOBALS['argv'] = [
              "/wordpress/wp-cli.phar",
              "--path=/wordpress",
              ${wpCliArgs.join('\n')}
            ];

            function iconv_substr($str, $from, $to = 1) { return substr($str, $from, $to); }
            function iconv_strlen($str) { return strlen($str); }

            define('STDIN', fopen('php://stdin', 'rb'));
            define('STDOUT', fopen('php://stdout', 'wb'));
            define('STDERR', fopen('/tmp/stderr', 'wb'));

            require( "/wordpress/wp-cli.phar" );
            `
          );

          const output = await playground.run({
            scriptPath: '/wordpress/run-cli.php'
          });

          const stderr = await playground?.readFileAsText('/tmp/stderr');
          stderr.split('\n').forEach(line => {
            terminalRef.current?.writeln(line);
          });

          const decodedOutput = new TextDecoder().decode(output.body);
          decodedOutput.split('\n').slice(1, decodedOutput.length).forEach(line => {
            terminalRef.current?.writeln(line);
          });
        }
        break;

      case 'phpunit':
        if (playground) {
          const phpunitArgs = args.map(arg => `"${arg.replaceAll('"', '\\"')}",`)

          await playground?.writeFile('/tmp/stderror', '');

          await playground?.writeFile('/wordpress/run-tests.php',
            `<?php
            namespace {
              $_SERVER['argv'] = [
                '../wordpress-develop/vendor/phpunit/phpunit/phpunit',
                '-c',
                'wordpress-develop/phpunit.xml.dist',
                ${phpunitArgs.join('\n')}
              ];

              function iconv_substr($str, $from, $to = 1) { return substr($str, $from, $to); }
              function iconv_strlen($str) { return strlen($str); }

              function proc_open( $command, $descriptor_spec, $pipes ) { return false; }

              define('STDIN', fopen('php://stdin', 'rb'));
              define('STDOUT', fopen('php://stdout', 'wb'));
              define('STDERR', fopen('/tmp/stderr', 'wb'));

              define('WP_RUN_CORE_TESTS', true);
              putenv('WP_TESTS_SKIP_INSTALL=1');
            }

            namespace Composer {
              require( "../wordpress-develop/vendor/phpunit/phpunit/phpunit" );
            }
            `
          );

          try {
          const output = await playground.run({
            scriptPath: '/wordpress/run-tests.php'
          });

          const decodedOutput = new TextDecoder().decode(output.body);
          decodedOutput.split('\n').slice(1, decodedOutput.length).forEach(line => {
            terminalRef.current?.writeln(line);
          });
          } catch (err) {
            console.log(err);
          }

          const stderr = await playground?.readFileAsText('/tmp/stderr');
          stderr.split('\n').forEach(line => {
            terminalRef.current?.writeln(line);
          });
        }

        break;

      default:
          terminalRef.current?.writeln(`${cmd}: Command not found`);

    }

    terminalRef.current?.write('$ ');

    isRunningCommand.current = false;
  }

  useEffect(() => {
    if (!terminalContainer.current || !playground) {
      return;
    }

    const term = new Terminal({ convertEol: true });
    terminalRef.current = term;

    term.open(terminalContainer.current);
    term.write('$ ');

    let command = '';

    term.onKey(async ({key, domEvent: evt }) => {
      if (isRunningCommand.current) {
        return;
      }

      const printable = !evt.altKey && !evt.ctrlKey && !evt.metaKey;

      if (evt.keyCode === 8) {
        if (command.length) {
          // Do not delete the prompt
          term.write('\b \b');
          command = command.slice(0, command.length - 1);
        }
      } else if (printable) {
        if (key === '\r') {
          term.write('\n');
          console.log(`Sending command: ${command}`);
          await runCommand(command);
          command = '';
        } else {
          term.write(evt.key);
          command += evt.key;
        }
      }
    });

    term.attachCustomKeyEventHandler((arg) => {
      if ((arg.metaKey || arg.ctrlKey) && arg.code === "KeyV" && arg.type === "keydown") {
        navigator.clipboard.readText()
          .then(text => {
            term.write(text);
            command += text;
          })
      }
      return true;
    });

    return () => {
      term.dispose();
    }
  }, [playground, runCommand])

  const editorRef = useRef<CodeMirrorRef>(null);
  const [editedFile, setEditedFile] = useState<string | undefined>();

  const onFileChange = useMemo(
    () =>
    {
      return (async ({ fileName, contents }) => {
        if (!playground) {
          return;
        }
        await playground.writeFile(fileName, contents);
        await playground.writeFile(fileName.replace('/src/', '/build/'), contents);
      });
    },
    [playground]
  );

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

	if (isSeamless) {
		return (
			<ViewportWithLoading
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		);
	}

	return (
    <Fragment>

		<BrowserChrome
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={updatedToolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
		>
			<ViewportWithLoading
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		</BrowserChrome>
      {initialFile && (
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
      )}
    <div className={css.terminal} ref={terminalContainer} />
    </Fragment>
	);
}

interface ViewportWithLoadingProps {
	iframeRef: Ref<HTMLIFrameElement>;
	loadingProgress: ProgressObserverEvent;
	ready: boolean;
}

const ViewportWithLoading = function LoadedViewportComponent({
	iframeRef,
	loadingProgress,
	ready,
}: ViewportWithLoadingProps) {
	return (
		<div className={css.fullSize}>
			<ProgressBar
				caption={loadingProgress.caption || 'Preparing WordPress...'}
				mode={loadingProgress.mode}
				percentFull={loadingProgress.progress}
				visible={!ready}
			/>
			<iframe
				title="Playground Viewport"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
