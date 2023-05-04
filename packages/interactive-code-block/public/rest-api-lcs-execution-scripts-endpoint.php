<?php

const FORMAT_PLAINTEXT = 'plaintext';
const FORMAT_HTML = 'html';
const FORMAT_JSON_TABULAR = 'jsontabular';
const FORMAT_JSON_TABULAR_SQL = 'jsontabularsql';
const VALID_OUTPUT_FORMATS = array(
    FORMAT_PLAINTEXT,
    FORMAT_HTML,
    FORMAT_JSON_TABULAR,
    FORMAT_JSON_TABULAR_SQL,
);

const RUNNER_PHP = 'PHP';
const RUNNER_PLAYGROUND = 'WordPress Playground';
const VALID_CODE_RUNNERS = array(
    RUNNER_PHP,
    RUNNER_PLAYGROUND,
);

class LCS_Execution_Scripts_Endpoint
{
    // WP options key for storing execution scripts
    const OPTION_KEY = 'lcs_execution_scripts';

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes()
    {
        register_rest_route('interactive-code-block/v1', '/execution-scripts', [
            'methods' => 'GET',
            'callback' => [$this, 'get_execution_scripts'],
            'permission_callback' => [$this, 'has_permission'],
        ]);

        register_rest_route('interactive-code-block/v1', '/execution-scripts', [
            'methods' => 'POST',
            'callback' => [$this, 'create_execution_script'],
            'permission_callback' => [$this, 'has_permission'],
            'args' => [
                'name' => [
                    'required' => true,
                    'validate_callback' => function ($param, $request, $key) {
                        return is_string($param);
                    },
                ],
                'content' => [
                    'required' => true,
                    'validate_callback' => function ($param, $request, $key) {
                        return is_string($param);
                    },
                ],
                'runner' => [
                    'required' => true,
                    'validate_callback' => function ($param, $request, $key) {
                        return in_array($param, VALID_CODE_RUNNERS);
                    },
                ],
                'outputFormat' => [
                    'validate_callback' => function ($param, $request, $key) {
                        return in_array($param, VALID_OUTPUT_FORMATS);
                    },
                ],
                'libraries' => [
                    'required' => false,
                    'validate_callback' => function ($param, $request, $key) {
                        if (!is_array($param)) {
                            return false;
                        }
                        foreach ($param as $library) {
                            if (!is_string($library)) {
                                return false;
                            }
                        }
                        return true;
                    },
                ],
            ],
        ]);

        register_rest_route('interactive-code-block/v1', '/execution-scripts/(?P<id>[a-z0-9]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_execution_script'],
            'permission_callback' => [$this, 'has_permission'],
        ]);

        register_rest_route('interactive-code-block/v1', '/execution-scripts/(?P<id>[a-z0-9]+)', [
            'methods' => 'PUT',
            'callback' => [$this, 'update_execution_script'],
            'permission_callback' => [$this, 'has_permission'],
            'args' => [
                'name' => [
                    'validate_callback' => function ($param, $request, $key) {
                        return is_string($param);
                    },
                ],
                'runner' => [
                    'validate_callback' => function ($param, $request, $key) {
                        return in_array($param, VALID_CODE_RUNNERS);
                    },
                ],
                'outputFormat' => [
                    'validate_callback' => function ($param, $request, $key) {
                        return in_array($param, VALID_OUTPUT_FORMATS);
                    },
                ],
                'content' => [
                    'validate_callback' => function ($param, $request, $key) {
                        return is_string($param);
                    },
                ],
            ],
        ]);

        register_rest_route('interactive-code-block/v1', '/execution-scripts/(?P<id>[a-z0-9]+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'delete_execution_script'],
            'permission_callback' => [$this, 'has_permission'],
        ]);
    }

    public function has_permission()
    {
        return current_user_can('upload_files') && current_user_can('edit_posts');
    }

    public function get_execution_scripts()
    {
        return array_values(get_option(self::OPTION_KEY, []));
    }

    public function create_execution_script($request)
    {
        $scripts = get_option(self::OPTION_KEY, []);

        do {
            $id = uniqid();
        } while (array_key_exists($id, $scripts));

        $scripts[$id] = [
            'id' => $id,
            'name' => $request->get_param('name'),
            'runner' => $request->get_param('runner'),
            'outputFormat' => $request->get_param('outputFormat'),
            'content' => $request->get_param('content'),
            'libraries' => $request->get_param('libraries') ?: [],
        ];

        update_option(self::OPTION_KEY, $scripts);

        return $scripts[$id];
    }

    public function get_execution_script($request)
    {
        $id = $request['id'];
        $scripts = get_option(self::OPTION_KEY, []);

        if (!array_key_exists($id, $scripts)) {
            return new WP_Error('rest_invalid_param', 'Execution script not found.', ['status' => 404]);
        }

        return $scripts[$id];
    }

    public function update_execution_script($request)
    {
        $id = $request['id'];
        $new_name = $request->get_param('name');
        $new_runner = $request->get_param('runner');
        $new_content = $request->get_param('content');
        $new_libraries = $request->get_param('libraries');

        $scripts = get_option(self::OPTION_KEY, []);

        if (!array_key_exists($id, $scripts)) {
            return new WP_Error('rest_invalid_param', 'Execution script not found.', ['status' => 404]);
        }

        if ($new_name) {
            $scripts[$id]['name'] = $new_name;
        }
        if ($new_runner) {
            $scripts[$id]['runner'] = $new_runner;
        }
        if ($new_content) {
            $scripts[$id]['content'] = $new_content;
        }
        if ($new_libraries) {
            $scripts[$id]['libraries'] = $new_libraries;
        }
        if ($request->has_param('outputFormat')) {
            $scripts[$id]['outputFormat'] = $request->get_param('outputFormat');
        }
        update_option(self::OPTION_KEY, $scripts);

        return $scripts[$id];
    }

    public function delete_execution_script($request)
    {
        $id = $request['id'];

        $scripts = get_option(self::OPTION_KEY, []);

        if (!array_key_exists($id, $scripts)) {
            return new WP_Error('rest_invalid_param', 'Execution script not found.', ['status' => 404]);
        }

        unset($scripts[$id]);
        update_option(self::OPTION_KEY, $scripts);

        return true;
    }
}