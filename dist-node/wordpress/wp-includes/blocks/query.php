<?php
 function register_block_core_query() { register_block_type_from_metadata( __DIR__ . '/query' ); } add_action( 'init', 'register_block_core_query' ); 