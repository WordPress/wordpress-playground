import Modal from 'react-modal';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import css from './style.module.css';
import {PlaygroundClient} from '@wp-playground/playground-remote';
import {Terminal} from 'xterm';

Modal.setAppElement('#root');

interface EditorButtonProps {
  playground?: PlaygroundClient;
}

export default function TerminalButton({ playground }: EditorButtonProps) {
  const [isOpen, setOpen] = useState(false);
  const terminalContainer = useRef<HTMLDivElement>();
  const terminalRef = useRef<Terminal>();

  const isRunningCommand = useRef<boolean>(false);

  const runCommand = useCallback(async (command: string) => {
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
        // eslint-disable-next-line no-case-declarations
        const file = await playground?.readFileAsText(args[0]);
        terminalRef.current?.writeln(file || '');
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
              "--path=/wordpress/build",
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
                '/wordpress/vendor/phpunit/phpunit/phpunit',
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
              require( __DIR__ . "/vendor/phpunit/phpunit/phpunit" );
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
  }, [playground]);

  const [counter, setCounter]= useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (!terminalContainer.current || !playground) {
      setCounter((v) => v+1);
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
  }, [playground, runCommand, isOpen, counter])

  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  return (
    <>
      <button
        id="import-open-modal--btn"
        className={css.btn}
        aria-label="Open Playground import window"
        onClick={openModal}
      >
        <svg style={{fill: '#fff'}} xmlns="http://www.w3.org/2000/svg" height="48" width="48"><path d="M7 40q-1.2 0-2.1-.9Q4 38.2 4 37V11q0-1.2.9-2.1Q5.8 8 7 8h34q1.2 0 2.1.9.9.9.9 2.1v26q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h34V15.2H7V37Zm8-3.6-2.1-2.1 5.15-5.2-5.2-5.2L15 18.8l7.3 7.3Zm9.5.2v-3h11v3Z"/></svg>
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
            width: 1200,
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
        <div className={css.terminal} ref={terminalContainer} />
      </Modal>
    </>
  );
}
