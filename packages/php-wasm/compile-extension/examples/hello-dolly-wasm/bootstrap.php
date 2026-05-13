<?php
/**
 * PHP bootstrap for the Hello Dolly WASM example.
 *
 * Playground installs this file as an mu-plugin. The native function
 * hello_dolly_wasm_get_lyric() is provided by the PHP.wasm extension.
 */

if ( ! function_exists( 'hello_dolly_wasm_get_lyric' ) ) {
	return;
}

function hello_dolly_wasm_render() {
	$lyric_count = 10;
	$lyric       = hello_dolly_wasm_get_lyric( mt_rand( 0, $lyric_count - 1 ) );

	printf(
		'<p id="hello-dolly-wasm"><span class="screen-reader-text">%s </span>%s</p>',
		esc_html__( 'Greeting from Hello Dolly WASM:', 'default' ),
		esc_html( $lyric )
	);
}

function hello_dolly_wasm_css() {
	echo "
	<style>
	#hello-dolly-wasm {
		float: right;
		padding: 5px 10px;
		margin: 0;
		font-size: 12px;
		line-height: 1.7;
	}
	.rtl #hello-dolly-wasm {
		float: left;
	}
	.block-editor-page #hello-dolly-wasm {
		display: none;
	}
	</style>
	";
}
