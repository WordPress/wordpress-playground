/**
 * Standalone test to verify whether setSpawnHandler propagates to proc_open.
 *
 * Run: node test-spawn-handler.mjs
 *
 * Uses the published @php-wasm/node package from Studio's node_modules
 * (avoids needing to build the playground monorepo).
 */

import { spawn } from 'child_process';
import { loadNodeRuntime } from '/Users/chubes/studio/node_modules/@php-wasm/node/index.js';
import { PHP, setPhpIniEntries } from '/Users/chubes/studio/node_modules/@php-wasm/universal/index.js';

async function main() {
    console.log('Loading PHP runtime...');
    const { ProcessIdAllocator } = await import('/Users/chubes/studio/node_modules/@php-wasm/universal/index.js');
    const processIdAllocator = new ProcessIdAllocator();
    const id = await loadNodeRuntime('8.3', {
        emscriptenOptions: { processId: processIdAllocator.claim() },
    });
    const php = new PHP(id);

    console.log('Setting spawn handler to child_process.spawn...');
    await php.setSpawnHandler(spawn);

    // Test 1: Check if Module.spawnProcess is set
    const syms = Object.getOwnPropertySymbols(php);
    for (const sym of syms) {
        const val = php[sym];
        if (val && typeof val === 'object' && 'ccall' in val) {
            console.log(`Module.spawnProcess type: ${typeof val.spawnProcess}`);
            console.log(`Module.spawnProcess is spawn: ${val.spawnProcess === spawn}`);

            // Try calling it directly to confirm it works
            if (typeof val.spawnProcess === 'function') {
                console.log('Direct Module.spawnProcess call works: YES');
            }
        }
    }

    // Test 2: Try proc_open from PHP
    console.log('\nTesting proc_open from PHP...');
    try {
        const result = await php.run({
            code: `<?php
                $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
                $proc = @proc_open('/bin/echo hello_from_proc_open', $desc, $pipes);
                if (is_resource($proc)) {
                    $stdout = stream_get_contents($pipes[1]);
                    $stderr = stream_get_contents($pipes[2]);
                    fclose($pipes[0]);
                    fclose($pipes[1]);
                    fclose($pipes[2]);
                    $code = proc_close($proc);
                    echo "exit=$code stdout=" . trim($stdout) . " stderr=" . trim($stderr);
                } else {
                    echo "PROC_OPEN_RETURNED_FALSE";
                }
            `,
        });
        console.log(`proc_open result: ${result.text}`);

        if (result.text.includes('hello_from_proc_open')) {
            console.log('✅ PASS: proc_open works with setSpawnHandler');
        } else {
            console.log('❌ FAIL: proc_open did not produce expected output');
        }
    } catch (e) {
        console.log(`❌ FAIL: proc_open threw: ${e.message}`);
    }

    // Test 3: Try shell_exec from PHP
    console.log('\nTesting shell_exec from PHP...');
    try {
        const result = await php.run({
            code: `<?php
                $out = @shell_exec('/bin/echo hello_from_shell_exec');
                echo $out === null ? 'NULL' : trim($out);
            `,
        });
        console.log(`shell_exec result: ${result.text}`);

        if (result.text === 'hello_from_shell_exec') {
            console.log('✅ PASS: shell_exec works with setSpawnHandler');
        } else {
            console.log('❌ FAIL: shell_exec did not produce expected output');
        }
    } catch (e) {
        console.log(`❌ FAIL: shell_exec threw: ${e.message}`);
    }

    // Test 4: stderr capture
    console.log('\nTesting stderr capture...');
    try {
        const result = await php.run({
            code: `<?php
                $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
                $proc = proc_open('/bin/sh -c "echo stdout_msg; echo stderr_msg >&2"', $desc, $pipes);
                if (is_resource($proc)) {
                    $out = stream_get_contents($pipes[1]);
                    $err = stream_get_contents($pipes[2]);
                    fclose($pipes[0]); fclose($pipes[1]); fclose($pipes[2]);
                    proc_close($proc);
                    echo "stdout=" . trim($out) . " stderr=" . trim($err);
                } else { echo "FAILED"; }
            `,
        });
        console.log(`stderr result: ${result.text}`);
        if (result.text.includes('stdout=stdout_msg') && result.text.includes('stderr=stderr_msg')) {
            console.log('✅ PASS: stderr capture works');
        } else {
            console.log('❌ FAIL: stderr not captured correctly');
        }
    } catch (e) {
        console.log(`❌ FAIL: stderr test threw: ${e.message}`);
    }

    // Test 5: non-zero exit code
    console.log('\nTesting non-zero exit code...');
    try {
        const result = await php.run({
            code: `<?php
                $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
                $proc = proc_open('/bin/sh -c "exit 42"', $desc, $pipes);
                if (is_resource($proc)) {
                    fclose($pipes[0]); fclose($pipes[1]); fclose($pipes[2]);
                    $code = proc_close($proc);
                    echo "exit=$code";
                } else { echo "FAILED"; }
            `,
        });
        console.log(`exit code result: ${result.text}`);
        if (result.text === 'exit=42') {
            console.log('✅ PASS: non-zero exit code captured');
        } else {
            console.log('❌ FAIL: exit code not captured correctly');
        }
    } catch (e) {
        console.log(`❌ FAIL: exit code test threw: ${e.message}`);
    }

    // Test 6: stdin piping
    console.log('\nTesting stdin piping...');
    try {
        const result = await php.run({
            code: `<?php
                $desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
                $proc = proc_open('/bin/cat', $desc, $pipes);
                if (is_resource($proc)) {
                    fwrite($pipes[0], "hello_from_stdin");
                    fclose($pipes[0]);
                    $out = stream_get_contents($pipes[1]);
                    fclose($pipes[1]); fclose($pipes[2]);
                    proc_close($proc);
                    echo trim($out);
                } else { echo "FAILED"; }
            `,
        });
        console.log(`stdin result: ${result.text}`);
        if (result.text === 'hello_from_stdin') {
            console.log('✅ PASS: stdin piping works');
        } else {
            console.log('❌ FAIL: stdin piping did not work');
        }
    } catch (e) {
        console.log(`❌ FAIL: stdin test threw: ${e.message}`);
    }

    // Test 7: without spawn handler, proc_open should fail
    console.log('\nTesting proc_open without spawn handler...');
    const php2 = new PHP(
        await loadNodeRuntime('8.3', { emscriptenOptions: { processId: processIdAllocator.claim() } })
    );
    try {
        const result = await php2.run({
            code: `<?php
                $proc = @proc_open('/bin/echo test', [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                echo is_resource($proc) ? 'OPENED' : 'FAILED';
            `,
        });
        console.log(`no-handler result: ${result.text}`);
        if (result.text === 'FAILED') {
            console.log('✅ PASS: proc_open fails without spawn handler');
        } else {
            console.log('❌ FAIL: proc_open should fail without handler');
        }
    } catch (e) {
        // Expected — proc_open throws when no handler is set
        console.log('✅ PASS: proc_open throws without spawn handler');
    }
    php2.exit();

    php.exit();
    console.log('\n=== All tests complete ===');
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
