const load = require('./public/php_7_4.js')
const php = load(
    'NODE',
    {
        print: (str) => console.log(str),
        printErr: (str) => console.log(str),
        onRuntimeInitialized() {
            php._php_wasm_init();
            php.FS.writeFile('/script.php', `<?php echo 'Hello World'; ?>`);
            // php._wasm_set_path_translated(`/script.php`);
            php._wasm_set_php_code(`Hi`);
            php._wasm_sapi_handle_request();
            // console.log(php.)
        }
    }
)
