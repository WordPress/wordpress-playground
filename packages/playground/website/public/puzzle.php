<?php
error_reporting(0);
header('Content-Type: application/json');

if (!isset($_POST["api_key"])) {
    response("error", "Please provide an API key.");
}
if ($_POST["api_key"] !== getApiKey()) {
    response("error", "Invalid API key.");
}

if (empty(getOpenAiApiKey())) {
    response("error", "The API isn't configured properly. Please contact the administrator.");
}

if (!isset($_POST["action"])) {
    response("error", "Please provide ac action.");
}

if ($_POST["action"] == "read-image") {
    if (!isset($_POST["image"])) {
        response("error", "Please provide an image.");
    }
    readImage($_POST["image"]);
} else if ($_POST["action"] == "site-name") {
    siteName();
} else if ($_POST["action"] === 'post') {
    post();
} else {
    response("error", "Invalid action.");
}

function getApiKey()
{
    return getenv('PUZZLE_API_KEY');
}

function getOpenAiApiKey()
{
    return getenv('OPEN_AI_API_KEY');
}

function siteName()
{
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.openai.com/v1/completions",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => json_encode([
            "model" => "gpt-4o",
            "prompt" => "Please come up with a random name for a website.
            That's related to playing, but don't use the word 'play' in the name.
            Don't suggest names combining multiple words into one.
            Return only the website name without any additional text or quotes surrounding it as one line.",
            "temperature" => 1,
            "max_tokens" => 256,
            "top_p" => 1,
            "frequency_penalty" => 0,
            "presence_penalty" => 0,
        ]),
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json",
            "Authorization: Bearer " . getOpenAiApiKey(),
        ],
    ]);
    $response = curl_exec($curl);
    curl_close($curl);

    $response = json_decode($response, true);
    if (empty($response["choices"])) {
        response("error", "No response from OpenAI");
    }
    try {
        $output = $response["choices"][0]["text"];
        $output = trim($output);
        $output = str_replace('"', "", $output);
        $output = str_replace("'", "", $output);
        response("success", $output);
    } catch (Exception $e) {
        response("error", "Invalid response from OpenAI");
    }
}

function generatePost()
{
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.openai.com/v1/completions",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => json_encode([
            "model" => "gpt-4o",
            "prompt" => "Please write a short fictional blog post about a great experience someone had while attending a WordCamp.
            Make sure the post is complete and doesn't end abruptly. The post should be up to 300 words.
            The topic should be fun and not too serious. It should be something that people would enjoy reading.
            It should be safe for work and not contain any inappropriate content.
            Start with a title for the post and then write the content. Add two new lines after the title.
            Don't include any quotes or additional text in the output.
            Don't prefix the title with 'Title:', or content with the word 'Content:'.",
            "temperature" => 1,
            "max_tokens" => 512,
            "top_p" => 1,
            "frequency_penalty" => 0,
            "presence_penalty" => 0,
        ]),
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json",
            "Authorization: Bearer " . getOpenAiApiKey(),
        ],
    ]);
    $response = curl_exec($curl);
    curl_close($curl);

    $response = json_decode($response, true);
    if (empty($response["choices"])) {
        response("error", "No response from OpenAI");
    }
    try {
        $output = $response["choices"][0]["text"];

        $titleRegex = '/^\n\n?(.+?)\n\n/s';

        // Extract title and content
        preg_match($titleRegex, $output, $matches);
        $title = isset($matches[1]) ? $matches[1] : '';
        $title = str_replace('Title: ', "", $title);
        $title = str_replace('"', "", $title);
        $title = str_replace("#", "", $title);
        $title = trim($title);
        $title = addslashes($title);

        $slug = str_replace(' ', '-', strtolower($title));
        $slug = preg_replace('/[^A-Za-z0-9\-]/', '', $slug);

        $content = preg_replace($titleRegex, '', $output);
        $content = trim($content);
        $content = addslashes($content);

        return ['title' => $title, 'content' => $content, 'slug' => $slug];
    } catch (Exception $e) {
        return [];
    }
}

function isValidPost($post)
{
    return !empty($post['title']) && !empty($post['content']) && !empty($post['slug']);
}

function post()
{
    $max_tries = 2;
    $tries = 0;
    do {
        $post = generatePost();
    } while (
        !isValidPost($post) &&
        ++$tries < $max_tries
    );

    if (!isValidPost($post)) {
        response("error", "Failed to generate a post.");
    }

    response("success", $post);
}

function readImage($image)
{
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.openai.com/v1/chat/completions",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => json_encode([
            "model" => "gpt-4-turbo",
            "messages" => [
                [
                    "role" => "user",
                    "content" => [
                        [
                            "type" => "text",
                            "text" => "The image will contain puzzle pieces with text on them.
                            Please list all the puzzle pieces by only outputting the text on them, each in new line.
                            Valid lines of text are:
                            - Site name
                            - Post
                            - /wp-admin/
                            - Multisite
                            - Omnisend
                            - Google
                            - Jetpack
                            - Elementor
                            - YITH
                            - Dynamic.ooo
                            - PersonalizeWP
                            - JetFormBuilder
                            - Fastspring
                            - Cookiebot
                            - W3 Total Cache
                            - SiteGround
                            - Yoast
                            If the text is invalid, don't return it.
                            If you do not see puzzle pieces of paper with valid text on them, simply output 'NO'",
                        ],
                        [
                            "type" => "image",
                            "image_url" => [
                                "url" => $_POST["image"],
                            ],
                        ],
                    ],
                ],
            ],
        ]),
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json",
            "Authorization: Bearer " . getOpenAiApiKey(),
        ],
    ]);
    $response = curl_exec($curl);
    curl_close($curl);

    $response = json_decode($response, true);
    if (empty($response["choices"])) {
        response("error", "No response from OpenAI");
    }
    try {
        $output = $response["choices"][0]["message"]["content"];
        $output = explode("\n", $output);
        $output = array_map("trim", $output);
        $output = array_filter($output, function ($item) {
            return !empty($item) && $item !== "NO";
        });
        response("success", $output);
    } catch (Exception $e) {
        response("error", "Invalid response from OpenAI");
    }
}



function response($status, $message)
{
    if ($status == "error") {
        http_response_code(400);
    }
    die(json_encode(array("status" => $status, "message" => $message)));
}