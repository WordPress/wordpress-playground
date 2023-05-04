<?php

require_once(ABSPATH . 'wp-admin/includes/image.php');
require_once(ABSPATH . 'wp-admin/includes/file.php');
require_once(ABSPATH . 'wp-admin/includes/media.php');

class LCS_Libraries_Endpoint
{
    // WP options key for storing uploaded files
    const OPTION_KEY = 'interactive_code_libraries';

    const UPLOAD_DIR_SUFFIX = '/interactive_code_libraries';

    // WP uploads directory path
    private $uploads_dir;

    // WP uploads directory url
    private $uploads_url;

    public function __construct()
    {
        $this->uploads_dir = wp_upload_dir()['basedir'] . static::UPLOAD_DIR_SUFFIX;
        $this->uploads_url = wp_upload_dir()['baseurl'] . static::UPLOAD_DIR_SUFFIX;

        if (!file_exists($this->uploads_dir)) {
            mkdir($this->uploads_dir);
        }
    }

    public function register_routes()
    {
        register_rest_route('interactive-code-block/v1', '/libraries', [
            'methods' => 'GET',
            'callback' => [$this, 'get_libraries'],
            'permission_callback' => [$this, 'has_permission'],
        ]);

        register_rest_route('interactive-code-block/v1', '/libraries', [
            'methods' => 'POST',
            'callback' => [$this, 'upload_library'],
            'permission_callback' => [$this, 'has_permission'],
        ]);

        register_rest_route('interactive-code-block/v1', '/libraries/(?P<id>[a-z0-9]+)', [
            'methods' => 'GET',
            'callback' => [$this, 'get_library'],
            'permission_callback' => [$this, 'has_permission'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => [$this, 'validate_id'],
                ],
            ],
        ]);
        register_rest_route('interactive-code-block/v1', '/libraries/(?P<id>[a-z0-9]+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'delete_library'],
            'permission_callback' => [$this, 'has_permission'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => [$this, 'validate_id'],
                ],
            ],
        ]);
        register_rest_route('interactive-code-block/v1', '/libraries/(?P<id>[a-z0-9]+)', [
            'methods' => ['PUT', 'POST'],
            'callback' => [$this, 'update_library'],
            'permission_callback' => [$this, 'has_permission'],
            'args' => [
                'id' => [
                    'required' => true,
                    'validate_callback' => [$this, 'validate_id'],
                ],
                'name' => [],
            ],
        ]);

    }

    public function has_permission()
    {
        return current_user_can('upload_files') && current_user_can('edit_posts');
    }

    public function get_libraries($request)
    {
        return lcs_get_libraries_list();
    }

    public function upload_library($request)
    {
        $file = $this->sanitize_file($request);
        if (is_wp_error($file)) {
            return $file;
        }

        // If name already stored, replace the file 
        $libraries = get_option(self::OPTION_KEY, []);
        foreach ($libraries as $library) {
            if ($library['name'] === $file['name']) {
                $file_path = $this->uploads_dir . "/" . $library['id'];
                if (!move_uploaded_file($file['tmp_name'], $file_path)) {
                    return new WP_Error('rest_server_error', 'Failed to move uploaded file.', ['status' => 500]);
                }
                return $library;
            }
        }

        do {
            $file_name = uniqid();
        } while (file_exists($this->uploads_dir . $file_name));
        $file_path = $this->uploads_dir . "/$file_name";

        // Move the uploaded file to the uploads directory
        if (!move_uploaded_file($file['tmp_name'], $file_path)) {
            return new WP_Error('rest_server_error', 'Failed to move uploaded file.', ['status' => 500]);
        }

        // Add the file to the list of uploaded libraries
        $libraries = get_option(self::OPTION_KEY, []);
        $libraries[$file_name] = [
            'id' => $file_name,
            'name' => $file['name'],
            'type' => $file['type'],
            'size' => $file['size'],
        ];
        update_option(self::OPTION_KEY, $libraries);

        return $libraries[$file_name];
    }

    public function update_library($request)
    {
        $id = $request['id'];

        $libraries = get_option(self::OPTION_KEY, []);
        if (isset($request['name'])) {
            $libraries[$id]['name'] = $request['name'];
        }

        if (isset($request['file'])) {
            $file = $this->sanitize_file($request);
            if (is_wp_error($file)) {
                return $file;
            }

            // Replace the previous library file
            $file_path = $this->uploads_dir . "/$id";
            if (!move_uploaded_file($file['tmp_name'], $file_path)) {
                return new WP_Error('rest_server_error', 'Failed to move uploaded file.', ['status' => 500]);
            }

            // Update stored file details
            $libraries[$id]['type'] = $file['type'];
            $libraries[$id]['size'] = $file['size'];
        }
        update_option(self::OPTION_KEY, $libraries);

        return $libraries[$id];
    }

    public function get_library($request)
    {
        $id = $request['id'];
        $libraries = lcs_get_libraries_list();
        return $libraries[$id];
    }

    public function delete_library($request)
    {
        $id = $request['id'];

        // Remove the file from the list of uploaded files
        $libraries = get_option(self::OPTION_KEY, []);
        unset($libraries[$id]);
        update_option(self::OPTION_KEY, $libraries);

        // Delete the file from the uploads directory
        unlink($this->uploads_dir . "/$id");

        return true;
    }

    public function sanitize_file($request)
    {
        $files = $request->get_file_params();

        if (empty($files['file'])) {
            return new WP_Error('rest_server_error', 'No file was uploaded.', ['status' => 400]);
        }

        $file = $files['file'];

        if (is_wp_error($file)) {
            return new WP_Error('rest_server_error', 'There was an error uploading a file.', ['status' => 400]);
        }

        // Check if the uploaded file is smaller than the max size
        $max_size = wp_max_upload_size();
        if ($file['size'] > $max_size) {
            return new WP_Error('rest_invalid_param', 'File is too large.', ['status' => 400]);
        }

        return $file;
    }

    public function validate_id($id, $request, $key)
    {
        $files = get_option(self::OPTION_KEY, []);

        // Check if the file with the specified ID exists
        if (!array_key_exists($id, $files)) {
            return new WP_Error('rest_invalid_param', 'File not found.', ['status' => 404]);
        }

        return true;
    }

}

function lcs_get_libraries_list()
{
    $libraries = array_values(get_option(LCS_Libraries_Endpoint::OPTION_KEY, []));
    usort($libraries, function ($a, $b) {
        return strcmp(strtolower($a['name']), strtolower($b['name']));
    });
    $uploads_url = wp_upload_dir()['baseurl'] . LCS_Libraries_Endpoint::UPLOAD_DIR_SUFFIX;
    foreach ($libraries as $k => $library) {
        $libraries[$k]['url'] = $uploads_url . "/{$library['id']}";
    }
    return $libraries;
}