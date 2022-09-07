<?php
 interface Requests_Hooker { public function register($hook, $callback, $priority = 0); public function dispatch($hook, $parameters = array()); } 