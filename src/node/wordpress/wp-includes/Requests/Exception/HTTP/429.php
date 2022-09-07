<?php
 class Requests_Exception_HTTP_429 extends Requests_Exception_HTTP { protected $code = 429; protected $reason = 'Too Many Requests'; } 