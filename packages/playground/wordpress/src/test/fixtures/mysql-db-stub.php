<?php
$wpdb = new class() {
    public $ready = true;
    public $prefix = 'wp_';
    public $base_prefix = 'wp_';
    public $last_error = '';
    public $result;
    public function check_connection() { return true; }
    public function db_connect() { return true; }
    public function query($query) { return true; }
    public function get_results($query = null) { return []; }
    public function get_row($query = null) { return null; }
    public function get_var($query = null) { return null; }
    public function prepare($query, ...$args) { return $query; }
    public function select($db) { return true; }
    public function set_prefix($prefix) {
        $this->prefix = $prefix;
        $this->base_prefix = $prefix;
    }
    public function __call($name, $args) { return null; }
};
