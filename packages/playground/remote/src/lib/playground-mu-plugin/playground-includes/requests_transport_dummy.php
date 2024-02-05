<?php

/**
 * This transport does not perform any HTTP requests and only exists
 * to prevent the Requests class from complaining about not having any
 * transports.
 */
class Requests_Transport_Dummy_Base
{
	public $headers = '';

	public function __construct()
	{
	}

	public function __destruct()
	{
	}

	public function request($url, $headers = array(), $data = array(), $options = array())
	{
		return false;
	}

	public function request_multiple($requests, $options)
	{
		$responses = array();
		foreach ($requests as $id => $request) {
			$responses[] = false;
		}
		return $responses;
	}

	protected static function format_get($url, $data)
	{
		return $url;
	}

	public static function test($capabilities = array())
	{
		return true;
	}
}

if (class_exists('\WpOrg\Requests\Requests')) {
	class Requests_Transport_Dummy extends Requests_Transport_Dummy_Base implements \WpOrg\Requests\Transport
	{

	}
} else {
	class Requests_Transport_Dummy extends Requests_Transport_Dummy_Base implements Requests_Transport
	{

	}
}
