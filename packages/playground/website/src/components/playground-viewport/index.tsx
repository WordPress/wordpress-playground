import type { PlaygroundClient } from '@wp-playground/client';

import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import React, {ReactElement, Ref, useMemo, Fragment, useRef, useEffect, useState} from 'react';
import type {
	ProgressObserver,
	ProgressObserverEvent,
} from '@php-wasm/progress';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import ProgressBar from '../progress-bar';
import { usePlayground, useProgressObserver } from '../../lib/hooks';

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
	? () => window.location.reload()
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
          await playground?.writeFile(
            '/wordpress/wp-config.php',
            `<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/documentation/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'database_name_here' );

/** Database username */
define( 'DB_USER', 'username_here' );

/** Database password */
define( 'DB_PASSWORD', 'password_here' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/documentation/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */

define( 'CONCATENATE_SCRIPTS', false );

/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
\tdefine( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';`);

          const wpCliArgs = args.map(arg => `"${arg.replaceAll('"', '\\"')}",`)
          console.log(wpCliArgs);

          await playground?.writeFile('/tmp/stderror', '');
          await playground?.writeFile('/wordpress/run-cli.php',
            `<?php
            $GLOBALS['argv'] = [
              "/wp-cli.phar",
              "--path=/wordpress",
              ${wpCliArgs.join('\n')}
            ];

            function iconv_substr($str, $from, $to = 1) { return substr($str, $from, $to); }
            function iconv_strlen($str) { return strlen($str); }

            define('STDIN', fopen('php://stdin', 'rb'));
            define('STDOUT', fopen('php://stdout', 'wb'));
            define('STDERR', fopen('/tmp/stderr', 'wb'));

            require( "/wp-cli.phar" );
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
  }, [playground])

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
