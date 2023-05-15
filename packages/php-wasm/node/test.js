const load = require('./public/php_7_4.js')
const php = load(
    'NODE',
    {
		onAbort(reason) {
			console.error('WASM aborted: ');
			console.error(reason);
        },
        ENV: {
            // USE_ZEND_ALLOC: '0',
        },
		noInitialRun: true,
        print: (str) => console.log(str),
        printErr: (str) => console.log(str),
        async onRuntimeInitialized() {
            php._php_wasm_init();
            php.FS.writeFile('/script.php', `<?php
                file_put_contents('/test.txt', 'Hi!');
                echo 'Hello World'; ?>
            `);
            // php._wasm_set_path_translated(`/script.php`);
            php._wasm_set_php_code(`
                <?php
                file_put_contents('/test.txt', 'Hi!');
                echo "Hi!";
            `);
            console.log('a');
            try {
                // This errors with bus error:
                // const result = await php._run_php(`a`);

                // This errors with zend_mm_heap corrupted:
                const result = await php._wasm_sapi_handle_request();
                console.log({ result });
            } catch (e) {
                console.error(e);
            }
            console.log(php.FS.readdir('/'));
            console.log(php.FS.readdir('/tmp'));
            // console.log(
            //     new TextDecoder().decode(php.FS.readFile('/tmp/stdout'))
            // );
            // console.log(php.FS.readFile('/tmp/stderr'));
        }
    }
)
