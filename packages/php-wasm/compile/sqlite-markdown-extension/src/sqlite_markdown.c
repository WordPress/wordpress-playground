#include "sqlite3ext.h"
SQLITE_EXTENSION_INIT1

#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

typedef struct MetaEntry {
    sqlite3_int64 meta_id;
    char *meta_key;
    char *meta_value;
} MetaEntry;

typedef struct PostRecord {
    sqlite3_int64 id;
    sqlite3_int64 post_parent;
    char *path;
    char *post_title;
    char *post_name;
    char *post_status;
    char *post_type;
    char *post_date_gmt;
    char *post_modified_gmt;
    char *post_content;
    char *post_parent_slug_ref;
    bool use_index_path;
    MetaEntry *meta_entries;
    int meta_count;
    int meta_capacity;
} PostRecord;

typedef struct Dataset {
    PostRecord *posts;
    int count;
    int capacity;
    sqlite3_int64 max_post_id;
    sqlite3_int64 max_meta_id;
} Dataset;

typedef struct TextBuffer {
    char *data;
    size_t length;
    size_t capacity;
} TextBuffer;

enum PostColumns {
    POST_COL_ID = 0,
    POST_COL_PARENT,
    POST_COL_TITLE,
    POST_COL_NAME,
    POST_COL_STATUS,
    POST_COL_TYPE,
    POST_COL_DATE_GMT,
    POST_COL_MODIFIED_GMT,
    POST_COL_CONTENT,
    POST_COL_COUNT
};

enum MetaColumns {
    META_COL_ID = 0,
    META_COL_POST_ID,
    META_COL_KEY,
    META_COL_VALUE,
    META_COL_COUNT
};

typedef struct PostsTable {
    sqlite3_vtab base;
    char *root;
} PostsTable;

typedef struct PostsCursor {
    sqlite3_vtab_cursor base;
    Dataset dataset;
    int index;
} PostsCursor;

typedef struct MetaRowRef {
    int post_index;
    int meta_index;
} MetaRowRef;

typedef struct PostMetaTable {
    sqlite3_vtab base;
    char *root;
} PostMetaTable;

typedef struct PostMetaCursor {
    sqlite3_vtab_cursor base;
    Dataset dataset;
    MetaRowRef *rows;
    int row_count;
    int index;
} PostMetaCursor;

static PostRecord *find_post_by_id(Dataset *dataset, sqlite3_int64 id);
static char *join_path(const char *root, const char *filename);

static void free_string(char *value) {
    free(value);
}

static char *duplicate_string(const char *value) {
    size_t length;
    char *copy;

    if (value == NULL) {
        return NULL;
    }
    length = strlen(value);
    copy = malloc(length + 1);
    if (copy == NULL) {
        return NULL;
    }
    memcpy(copy, value, length + 1);
    return copy;
}

static char *duplicate_range(const char *start, size_t length) {
    char *copy;

    copy = malloc(length + 1);
    if (copy == NULL) {
        return NULL;
    }
    memcpy(copy, start, length);
    copy[length] = '\0';
    return copy;
}

static void free_meta_entry(MetaEntry *entry) {
    if (entry == NULL) {
        return;
    }
    free_string(entry->meta_key);
    free_string(entry->meta_value);
    entry->meta_key = NULL;
    entry->meta_value = NULL;
}

static void free_post_record(PostRecord *post) {
    int index;

    if (post == NULL) {
        return;
    }
    free_string(post->path);
    free_string(post->post_title);
    free_string(post->post_name);
    free_string(post->post_status);
    free_string(post->post_type);
    free_string(post->post_date_gmt);
    free_string(post->post_modified_gmt);
    free_string(post->post_content);
    free_string(post->post_parent_slug_ref);
    for (index = 0; index < post->meta_count; index++) {
        free_meta_entry(&post->meta_entries[index]);
    }
    free(post->meta_entries);
    memset(post, 0, sizeof(*post));
}

static void dataset_init(Dataset *dataset) {
    memset(dataset, 0, sizeof(*dataset));
}

static void dataset_reset(Dataset *dataset) {
    int index;

    if (dataset == NULL) {
        return;
    }
    for (index = 0; index < dataset->count; index++) {
        free_post_record(&dataset->posts[index]);
    }
    free(dataset->posts);
    memset(dataset, 0, sizeof(*dataset));
}

static int text_buffer_reserve(TextBuffer *buffer, size_t extra) {
    char *next_data;
    size_t required;
    size_t next_capacity;

    required = buffer->length + extra + 1;
    if (required <= buffer->capacity) {
        return SQLITE_OK;
    }

    next_capacity = buffer->capacity == 0 ? 256 : buffer->capacity;
    while (next_capacity < required) {
        next_capacity *= 2;
    }

    next_data = realloc(buffer->data, next_capacity);
    if (next_data == NULL) {
        return SQLITE_NOMEM;
    }
    buffer->data = next_data;
    buffer->capacity = next_capacity;
    return SQLITE_OK;
}

static int text_buffer_append_raw(TextBuffer *buffer, const char *text, size_t length) {
    int rc;

    rc = text_buffer_reserve(buffer, length);
    if (rc != SQLITE_OK) {
        return rc;
    }
    memcpy(buffer->data + buffer->length, text, length);
    buffer->length += length;
    buffer->data[buffer->length] = '\0';
    return SQLITE_OK;
}

static int text_buffer_append(TextBuffer *buffer, const char *text) {
    if (text == NULL) {
        return SQLITE_OK;
    }
    return text_buffer_append_raw(buffer, text, strlen(text));
}

static int text_buffer_append_char(TextBuffer *buffer, char value) {
    return text_buffer_append_raw(buffer, &value, 1);
}

static void text_buffer_reset(TextBuffer *buffer) {
    free(buffer->data);
    memset(buffer, 0, sizeof(*buffer));
}

static bool is_blank_line(const char *line) {
    while (*line != '\0') {
        if (!isspace((unsigned char)*line)) {
            return false;
        }
        line++;
    }
    return true;
}

static char *trim_copy(const char *source) {
    const char *start;
    const char *end;

    start = source;
    while (*start != '\0' && isspace((unsigned char)*start)) {
        start++;
    }
    end = source + strlen(source);
    while (end > start && isspace((unsigned char)end[-1])) {
        end--;
    }
    return duplicate_range(start, (size_t)(end - start));
}

static int read_text_file(const char *path, char **output, size_t *output_length) {
    FILE *file;
    char *buffer;
    long length;
    size_t read_length;

    *output = NULL;
    *output_length = 0;

    file = fopen(path, "rb");
    if (file == NULL) {
        return SQLITE_CANTOPEN;
    }
    if (fseek(file, 0, SEEK_END) != 0) {
        fclose(file);
        return SQLITE_IOERR;
    }
    length = ftell(file);
    if (length < 0) {
        fclose(file);
        return SQLITE_IOERR;
    }
    if (fseek(file, 0, SEEK_SET) != 0) {
        fclose(file);
        return SQLITE_IOERR;
    }

    buffer = malloc((size_t)length + 1);
    if (buffer == NULL) {
        fclose(file);
        return SQLITE_NOMEM;
    }
    read_length = fread(buffer, 1, (size_t)length, file);
    fclose(file);
    if (read_length != (size_t)length) {
        free(buffer);
        return SQLITE_IOERR;
    }
    buffer[length] = '\0';
    *output = buffer;
    *output_length = (size_t)length;
    return SQLITE_OK;
}

static int write_text_file_atomic(const char *path, const char *content, size_t length) {
    TextBuffer tmp_path = {0};
    FILE *file;
    int rc;

    rc = text_buffer_append(&tmp_path, path);
    if (rc != SQLITE_OK) {
        text_buffer_reset(&tmp_path);
        return rc;
    }
    rc = text_buffer_append(&tmp_path, ".tmp");
    if (rc != SQLITE_OK) {
        text_buffer_reset(&tmp_path);
        return rc;
    }

    file = fopen(tmp_path.data, "wb");
    if (file == NULL) {
        text_buffer_reset(&tmp_path);
        return SQLITE_CANTOPEN;
    }
    if (fwrite(content, 1, length, file) != length) {
        fclose(file);
        unlink(tmp_path.data);
        text_buffer_reset(&tmp_path);
        return SQLITE_IOERR_WRITE;
    }
    if (fclose(file) != 0) {
        unlink(tmp_path.data);
        text_buffer_reset(&tmp_path);
        return SQLITE_IOERR_FSYNC;
    }
    if (rename(tmp_path.data, path) != 0) {
        unlink(tmp_path.data);
        text_buffer_reset(&tmp_path);
        return SQLITE_IOERR;
    }
    text_buffer_reset(&tmp_path);
    return SQLITE_OK;
}

static int append_post_slot(Dataset *dataset, PostRecord **post) {
    PostRecord *next_posts;
    int next_capacity;

    if (dataset->count == dataset->capacity) {
        next_capacity = dataset->capacity == 0 ? 4 : dataset->capacity * 2;
        next_posts = realloc(dataset->posts, sizeof(PostRecord) * (size_t)next_capacity);
        if (next_posts == NULL) {
            return SQLITE_NOMEM;
        }
        dataset->posts = next_posts;
        dataset->capacity = next_capacity;
    }
    *post = &dataset->posts[dataset->count];
    memset(*post, 0, sizeof(**post));
    dataset->count++;
    return SQLITE_OK;
}

static int append_meta_slot(PostRecord *post, MetaEntry **meta) {
    MetaEntry *next_entries;
    int next_capacity;

    if (post->meta_count == post->meta_capacity) {
        next_capacity = post->meta_capacity == 0 ? 4 : post->meta_capacity * 2;
        next_entries = realloc(post->meta_entries, sizeof(MetaEntry) * (size_t)next_capacity);
        if (next_entries == NULL) {
            return SQLITE_NOMEM;
        }
        post->meta_entries = next_entries;
        post->meta_capacity = next_capacity;
    }
    *meta = &post->meta_entries[post->meta_count];
    memset(*meta, 0, sizeof(**meta));
    post->meta_count++;
    return SQLITE_OK;
}

static int parse_storage_segment(const char *segment, sqlite3_int64 *id, char **slug) {
    const char *dash;
    char *id_text;
    char *end_ptr;
    sqlite3_int64 parsed_id;

    *id = 0;
    *slug = NULL;

    if (segment == NULL || *segment == '\0') {
        return SQLITE_IGNORE;
    }

    dash = strchr(segment, '-');
    if (dash == NULL) {
        dash = segment + strlen(segment);
    }

    id_text = duplicate_range(segment, (size_t)(dash - segment));
    if (id_text == NULL) {
        return SQLITE_NOMEM;
    }
    parsed_id = strtoll(id_text, &end_ptr, 10);
    if (*end_ptr != '\0' || parsed_id <= 0) {
        free(id_text);
        return SQLITE_IGNORE;
    }
    free(id_text);

    *id = parsed_id;
    if (*dash == '-') {
        *slug = duplicate_string(dash + 1);
        if (*slug == NULL) {
            return SQLITE_NOMEM;
        }
    }
    return SQLITE_OK;
}

static int parse_filename(const char *filename, sqlite3_int64 *id, char **slug) {
    const char *dot;
    char *name = NULL;
    int rc;

    dot = strrchr(filename, '.');
    if (dot == NULL || strcmp(dot, ".md") != 0) {
        return SQLITE_IGNORE;
    }

    name = duplicate_range(filename, (size_t)(dot - filename));
    if (name == NULL) {
        return SQLITE_NOMEM;
    }
    rc = parse_storage_segment(name, id, slug);
    free(name);
    if (rc == SQLITE_IGNORE) {
        return SQLITE_IGNORE;
    }
    return rc;
}

static int decode_quoted_value(const char *value, char **output) {
    TextBuffer buffer = {0};
    size_t index;
    char quote;
    int rc = SQLITE_OK;

    *output = NULL;
    if (value == NULL || value[0] == '\0') {
        return SQLITE_ERROR;
    }
    quote = value[0];
    if (quote != '"' && quote != '\'') {
        return SQLITE_ERROR;
    }

    for (index = 1; value[index] != '\0'; index++) {
        char current = value[index];
        if (current == quote) {
            if (value[index + 1] != '\0') {
                char *tail = trim_copy(value + index + 1);
                if (tail == NULL) {
                    rc = SQLITE_NOMEM;
                } else if (*tail != '\0') {
                    rc = SQLITE_ERROR;
                }
                free(tail);
                if (rc != SQLITE_OK) {
                    text_buffer_reset(&buffer);
                    return rc;
                }
            }
            *output = buffer.data;
            return SQLITE_OK;
        }
        if (current == '\\') {
            char next = value[++index];
            if (next == '\0') {
                text_buffer_reset(&buffer);
                return SQLITE_ERROR;
            }
            switch (next) {
                case 'n':
                    current = '\n';
                    break;
                case 'r':
                    current = '\r';
                    break;
                case 't':
                    current = '\t';
                    break;
                case '\\':
                case '"':
                case '\'':
                    current = next;
                    break;
                default:
                    text_buffer_reset(&buffer);
                    return SQLITE_ERROR;
            }
        }
        rc = text_buffer_append_char(&buffer, current);
        if (rc != SQLITE_OK) {
            text_buffer_reset(&buffer);
            return rc;
        }
    }

    text_buffer_reset(&buffer);
    return SQLITE_ERROR;
}

static int decode_assignment_key(const char *key, char **output) {
    char quote;

    *output = NULL;
    if (key == NULL || key[0] == '\0') {
        return SQLITE_ERROR;
    }

    quote = key[0];
    if ((quote == '"' || quote == '\'') && strlen(key) >= 2) {
        return decode_quoted_value(key, output);
    }

    *output = duplicate_string(key);
    return *output == NULL ? SQLITE_NOMEM : SQLITE_OK;
}

static int parse_assignment(const char *line, char **key, char **value) {
    const char *cursor;
    const char *scan;
    const char *equals = NULL;
    char quote = '\0';

    *key = NULL;
    *value = NULL;

    cursor = line;
    while (*cursor != '\0' && isspace((unsigned char)*cursor)) {
        cursor++;
    }
    scan = cursor;
    while (*scan != '\0') {
        if (quote != '\0') {
            if (*scan == '\\') {
                scan++;
                if (*scan == '\0') {
                    return SQLITE_ERROR;
                }
            } else if (*scan == quote) {
                quote = '\0';
            }
        } else if (*scan == '"' || *scan == '\'') {
            quote = *scan;
        } else if (*scan == '=') {
            equals = scan;
            break;
        }
        scan++;
    }
    if (equals == NULL) {
        return SQLITE_ERROR;
    }

    *key = duplicate_range(cursor, (size_t)(equals - cursor));
    if (*key == NULL) {
        return SQLITE_NOMEM;
    }
    *value = trim_copy(equals + 1);
    if (*value == NULL) {
        free(*key);
        *key = NULL;
        return SQLITE_NOMEM;
    }

    {
        char *trimmed_key = trim_copy(*key);
        if (trimmed_key == NULL) {
            free(*key);
            free(*value);
            *key = NULL;
            *value = NULL;
            return SQLITE_NOMEM;
        }
        free(*key);
        *key = trimmed_key;
    }

    if (**key == '\0') {
        free(*key);
        free(*value);
        *key = NULL;
        *value = NULL;
        return SQLITE_ERROR;
    }
    return SQLITE_OK;
}

static int set_post_field(PostRecord *post, const char *key, const char *value) {
    char *decoded = NULL;
    char **target = NULL;
    char *end_ptr = NULL;
    int rc;

    if (strcmp(key, "post_parent") == 0 || strcmp(key, "post_parent_slug") == 0) {
        if (value[0] == '"' || value[0] == '\'') {
            rc = decode_quoted_value(value, &decoded);
            if (rc != SQLITE_OK) {
                return rc;
            }
            free(post->post_parent_slug_ref);
            post->post_parent_slug_ref = decoded;
            post->post_parent = 0;
            return SQLITE_OK;
        }
        post->post_parent = strtoll(value, &end_ptr, 10);
        if (end_ptr == NULL || *end_ptr != '\0' || post->post_parent < 0) {
            return SQLITE_ERROR;
        }
        free(post->post_parent_slug_ref);
        post->post_parent_slug_ref = NULL;
        return SQLITE_OK;
    }

    rc = decode_quoted_value(value, &decoded);
    if (rc != SQLITE_OK) {
        return rc;
    }

    if (strcmp(key, "post_title") == 0) {
        target = &post->post_title;
    } else if (strcmp(key, "post_name") == 0) {
        target = &post->post_name;
    } else if (strcmp(key, "post_status") == 0) {
        target = &post->post_status;
    } else if (strcmp(key, "post_type") == 0) {
        target = &post->post_type;
    } else if (strcmp(key, "post_date_gmt") == 0) {
        target = &post->post_date_gmt;
    } else if (strcmp(key, "post_modified_gmt") == 0) {
        target = &post->post_modified_gmt;
    } else {
        free(decoded);
        return SQLITE_ERROR;
    }

    free(*target);
    *target = decoded;
    return SQLITE_OK;
}

static int set_meta_field(MetaEntry *meta, const char *key, const char *value) {
    int rc;
    char *decoded = NULL;
    char *decoded_key = NULL;
    char *end_ptr;

    if (strcmp(key, "meta_id") == 0) {
        meta->meta_id = strtoll(value, &end_ptr, 10);
        if (*end_ptr != '\0' || meta->meta_id <= 0) {
            return SQLITE_ERROR;
        }
        return SQLITE_OK;
    }

    rc = decode_quoted_value(value, &decoded);
    if (rc != SQLITE_OK) {
        return rc;
    }

    if (strcmp(key, "meta_key") == 0) {
        free(meta->meta_key);
        meta->meta_key = decoded;
    } else if (strcmp(key, "meta_value") == 0) {
        free(meta->meta_value);
        meta->meta_value = decoded;
    } else {
        rc = decode_assignment_key(key, &decoded_key);
        if (rc != SQLITE_OK) {
            free(decoded);
            return rc;
        }
        if (meta->meta_key != NULL || meta->meta_value != NULL) {
            free(decoded);
            free(decoded_key);
            return SQLITE_ERROR;
        }
        meta->meta_key = decoded_key;
        meta->meta_value = decoded;
    }
    return SQLITE_OK;
}

static int parse_markdown_post(
    const char *path,
    sqlite3_int64 id,
    const char *slug,
    sqlite3_int64 parent_id_hint,
    const char *parent_slug_hint,
    bool use_index_path,
    PostRecord *post
) {
    char *text = NULL;
    size_t length = 0;
    const char *cursor;
    const char *end;
    const char *frontmatter_delimiter = NULL;
    int rc;
    MetaEntry *current_meta = NULL;

    rc = read_text_file(path, &text, &length);
    if (rc != SQLITE_OK) {
        return rc;
    }

    post->id = id;
    post->post_parent = parent_id_hint;
    post->path = duplicate_string(path);
    post->post_name = duplicate_string(slug);
    post->use_index_path = use_index_path;
    if (parent_id_hint <= 0 && parent_slug_hint != NULL) {
        post->post_parent_slug_ref = duplicate_string(parent_slug_hint);
    }
    if (post->path == NULL ||
        (slug != NULL && post->post_name == NULL) ||
        (parent_id_hint <= 0 && parent_slug_hint != NULL && post->post_parent_slug_ref == NULL)) {
        free(text);
        return SQLITE_NOMEM;
    }

    cursor = text;
    end = text + length;

    {
        const char *line_end = cursor;
        while (line_end < end && *line_end != '\n' && *line_end != '\r') {
            line_end++;
        }
        if ((size_t)(line_end - cursor) != 3) {
            free(text);
            return SQLITE_ERROR;
        }
        if (strncmp(cursor, "+++", 3) == 0) {
            frontmatter_delimiter = "+++";
        } else if (strncmp(cursor, "---", 3) == 0) {
            frontmatter_delimiter = "---";
        } else {
            free(text);
            return SQLITE_ERROR;
        }
        while (line_end < end && (*line_end == '\n' || *line_end == '\r')) {
            line_end++;
        }
        cursor = line_end;
    }

    while (cursor < end) {
        const char *line_end = cursor;
        char *line;
        while (line_end < end && *line_end != '\n' && *line_end != '\r') {
            line_end++;
        }
        line = duplicate_range(cursor, (size_t)(line_end - cursor));
        if (line == NULL) {
            free(text);
            return SQLITE_NOMEM;
        }
        while (line_end < end && (*line_end == '\n' || *line_end == '\r')) {
            line_end++;
        }
        cursor = line_end;

        if (strcmp(line, frontmatter_delimiter) == 0) {
            free(line);
            break;
        }
        if (is_blank_line(line)) {
            free(line);
            continue;
        }
        if (strcmp(line, "[[meta]]") == 0) {
            rc = append_meta_slot(post, &current_meta);
            free(line);
            if (rc != SQLITE_OK) {
                free(text);
                return rc;
            }
            continue;
        }
        {
            char *key = NULL;
            char *value = NULL;
            rc = parse_assignment(line, &key, &value);
            free(line);
            if (rc != SQLITE_OK) {
                free(text);
                return rc;
            }
            if (current_meta != NULL) {
                rc = set_meta_field(current_meta, key, value);
            } else {
                rc = set_post_field(post, key, value);
            }
            free(key);
            free(value);
            if (rc != SQLITE_OK) {
                free(text);
                return rc;
            }
        }
    }

    post->post_content = duplicate_range(cursor, (size_t)(end - cursor));
    free(text);
    if (post->post_content == NULL) {
        return SQLITE_NOMEM;
    }
    {
        int index;
        for (index = 0; index < post->meta_count; index++) {
            if (post->meta_entries[index].meta_id <= 0 ||
                post->meta_entries[index].meta_key == NULL ||
                post->meta_entries[index].meta_value == NULL) {
                return SQLITE_ERROR;
            }
        }
    }
    return SQLITE_OK;
}

static int resolve_parent_from_slug(Dataset *dataset, PostRecord *post) {
    int index;
    PostRecord *match = NULL;

    if (post->post_parent_slug_ref == NULL) {
        return SQLITE_OK;
    }

    for (index = 0; index < dataset->count; index++) {
        PostRecord *candidate = &dataset->posts[index];
        if (candidate->post_name != NULL &&
            strcmp(candidate->post_name, post->post_parent_slug_ref) == 0) {
            if (match != NULL) {
                return SQLITE_CONSTRAINT;
            }
            match = candidate;
        }
    }
    if (match == NULL) {
        return SQLITE_NOTFOUND;
    }

    post->post_parent = match->id;
    free(post->post_parent_slug_ref);
    post->post_parent_slug_ref = NULL;
    return SQLITE_OK;
}

static int validate_post_hierarchy(Dataset *dataset) {
    int index;
    int *state;

    state = calloc((size_t)dataset->count, sizeof(int));
    if (state == NULL) {
        return SQLITE_NOMEM;
    }

    for (index = 0; index < dataset->count; index++) {
        PostRecord *post = &dataset->posts[index];
        if (post->post_parent == post->id) {
            free(state);
            return SQLITE_CONSTRAINT;
        }
        if (post->post_parent != 0 && find_post_by_id(dataset, post->post_parent) == NULL) {
            free(state);
            return SQLITE_NOTFOUND;
        }
    }

    for (index = 0; index < dataset->count; index++) {
        int current = index;
        while (current >= 0) {
            PostRecord *post = &dataset->posts[current];
            PostRecord *parent;
            int parent_index;

            if (state[current] == 2) {
                break;
            }
            if (state[current] == 1) {
                free(state);
                return SQLITE_CONSTRAINT;
            }
            state[current] = 1;
            if (post->post_parent == 0) {
                break;
            }
            parent = find_post_by_id(dataset, post->post_parent);
            parent_index = (int)(parent - dataset->posts);
            current = parent_index;
        }

        current = index;
        while (current >= 0 && state[current] == 1) {
            PostRecord *post = &dataset->posts[current];
            PostRecord *parent = NULL;

            state[current] = 2;
            if (post->post_parent != 0) {
                parent = find_post_by_id(dataset, post->post_parent);
            }
            current = parent == NULL ? -1 : (int)(parent - dataset->posts);
        }
    }

    free(state);
    return SQLITE_OK;
}

static int derive_parent_hint_from_segment(
    const char *segment,
    sqlite3_int64 *parent_id,
    char **parent_slug
) {
    char *parsed_slug = NULL;
    int rc;

    *parent_id = 0;
    *parent_slug = NULL;
    if (segment == NULL) {
        return SQLITE_OK;
    }

    rc = parse_storage_segment(segment, parent_id, &parsed_slug);
    if (rc == SQLITE_OK) {
        *parent_slug = parsed_slug;
        return SQLITE_OK;
    }
    if (rc != SQLITE_IGNORE) {
        return rc;
    }

    *parent_slug = duplicate_string(segment);
    return *parent_slug == NULL ? SQLITE_NOMEM : SQLITE_OK;
}

static int compare_posts_by_id(const void *left, const void *right) {
    const PostRecord *left_post = left;
    const PostRecord *right_post = right;
    if (left_post->id < right_post->id) {
        return -1;
    }
    if (left_post->id > right_post->id) {
        return 1;
    }
    return 0;
}

static int load_dataset_directory(
    const char *root,
    const char *directory_path,
    const char *directory_segment,
    const char *parent_directory_segment,
    Dataset *dataset
) {
    DIR *directory;
    struct dirent *entry;

    (void)root;
    directory = opendir(directory_path);
    if (directory == NULL) {
        return SQLITE_CANTOPEN;
    }

    while ((entry = readdir(directory)) != NULL) {
        char *full_path = NULL;
        struct stat st;
        int rc;

        if (entry->d_name[0] == '.') {
            continue;
        }
        full_path = join_path(directory_path, entry->d_name);
        if (full_path == NULL) {
            closedir(directory);
            return SQLITE_NOMEM;
        }
        if (stat(full_path, &st) != 0) {
            free(full_path);
            closedir(directory);
            return SQLITE_IOERR;
        }

        if (S_ISDIR(st.st_mode)) {
            rc = load_dataset_directory(
                root,
                full_path,
                entry->d_name,
                directory_segment,
                dataset
            );
            free(full_path);
            if (rc != SQLITE_OK) {
                closedir(directory);
                return rc;
            }
            continue;
        }

        if (S_ISREG(st.st_mode)) {
            sqlite3_int64 id = 0;
            sqlite3_int64 parent_id_hint = 0;
            char *slug = NULL;
            char *parent_slug_hint = NULL;
            PostRecord *post = NULL;
            int meta_index;
            bool use_index_path = false;

            if (strcmp(entry->d_name, "index.md") == 0) {
                if (directory_segment == NULL) {
                    free(full_path);
                    continue;
                }
                rc = parse_storage_segment(directory_segment, &id, &slug);
                if (rc == SQLITE_IGNORE) {
                    free(full_path);
                    continue;
                }
                if (rc == SQLITE_OK) {
                    rc = derive_parent_hint_from_segment(
                        parent_directory_segment,
                        &parent_id_hint,
                        &parent_slug_hint
                    );
                }
                use_index_path = true;
            } else {
                rc = parse_filename(entry->d_name, &id, &slug);
                if (rc == SQLITE_IGNORE) {
                    free(full_path);
                    continue;
                }
                if (rc == SQLITE_OK) {
                    rc = derive_parent_hint_from_segment(
                        directory_segment,
                        &parent_id_hint,
                        &parent_slug_hint
                    );
                }
            }
            if (rc != SQLITE_OK) {
                free(slug);
                free(parent_slug_hint);
                free(full_path);
                closedir(directory);
                return rc;
            }

            rc = append_post_slot(dataset, &post);
            if (rc == SQLITE_OK) {
                rc = parse_markdown_post(
                    full_path,
                    id,
                    slug,
                    parent_id_hint,
                    parent_slug_hint,
                    use_index_path,
                    post
                );
            }
            free(slug);
            free(parent_slug_hint);
            free(full_path);
            if (rc != SQLITE_OK) {
                closedir(directory);
                return rc;
            }
            if (id > dataset->max_post_id) {
                dataset->max_post_id = id;
            }
            for (meta_index = 0; meta_index < post->meta_count; meta_index++) {
                if (post->meta_entries[meta_index].meta_id > dataset->max_meta_id) {
                    dataset->max_meta_id = post->meta_entries[meta_index].meta_id;
                }
            }
        } else {
            free(full_path);
        }
    }

    closedir(directory);
    return SQLITE_OK;
}

static int load_dataset(const char *root, Dataset *dataset) {
    int rc;
    int index;

    dataset_init(dataset);

    rc = load_dataset_directory(root, root, NULL, NULL, dataset);
    if (rc != SQLITE_OK) {
        dataset_reset(dataset);
        return rc;
    }

    if (dataset->count > 1) {
        qsort(dataset->posts, (size_t)dataset->count, sizeof(PostRecord), compare_posts_by_id);
    }
    for (index = 0; index < dataset->count; index++) {
        rc = resolve_parent_from_slug(dataset, &dataset->posts[index]);
        if (rc != SQLITE_OK) {
            dataset_reset(dataset);
            return rc;
        }
    }
    rc = validate_post_hierarchy(dataset);
    if (rc != SQLITE_OK) {
        dataset_reset(dataset);
        return rc;
    }
    return SQLITE_OK;
}

static int encode_string(TextBuffer *buffer, const char *value) {
    const char *cursor;
    int rc;

    if (value == NULL) {
        value = "";
    }
    rc = text_buffer_append_char(buffer, '"');
    if (rc != SQLITE_OK) {
        return rc;
    }
    for (cursor = value; *cursor != '\0'; cursor++) {
        switch (*cursor) {
            case '\\':
                rc = text_buffer_append(buffer, "\\\\");
                break;
            case '"':
                rc = text_buffer_append(buffer, "\\\"");
                break;
            case '\n':
                rc = text_buffer_append(buffer, "\\n");
                break;
            case '\r':
                rc = text_buffer_append(buffer, "\\r");
                break;
            case '\t':
                rc = text_buffer_append(buffer, "\\t");
                break;
            default:
                rc = text_buffer_append_char(buffer, *cursor);
                break;
        }
        if (rc != SQLITE_OK) {
            return rc;
        }
    }
    return text_buffer_append_char(buffer, '"');
}

static int append_key_value(TextBuffer *buffer, const char *key, const char *value) {
    int rc;

    rc = text_buffer_append(buffer, key);
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(buffer, " = ");
    }
    if (rc == SQLITE_OK) {
        rc = encode_string(buffer, value);
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append_char(buffer, '\n');
    }
    return rc;
}

static bool meta_key_requires_quotes(const char *key) {
    const unsigned char *cursor;

    if (key == NULL || *key == '\0') {
        return true;
    }

    for (cursor = (const unsigned char *)key; *cursor != '\0'; cursor++) {
        if (!isalnum(*cursor) && *cursor != '_' && *cursor != '-') {
            return true;
        }
    }
    return false;
}

static int append_meta_key_value(TextBuffer *buffer, const char *key, const char *value) {
    int rc;

    if (meta_key_requires_quotes(key)) {
        rc = encode_string(buffer, key);
    } else {
        rc = text_buffer_append(buffer, key);
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(buffer, " = ");
    }
    if (rc == SQLITE_OK) {
        rc = encode_string(buffer, value);
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append_char(buffer, '\n');
    }
    return rc;
}

static char *build_post_segment(sqlite3_int64 id, const char *slug) {
    TextBuffer buffer = {0};
    char number[32];
    int rc;
    const char *effective_slug = slug;

    if (effective_slug == NULL || *effective_slug == '\0') {
        effective_slug = "post";
    }
    snprintf(number, sizeof(number), "%lld", (long long)id);
    rc = text_buffer_append(&buffer, number);
    if (rc == SQLITE_OK) {
        rc = text_buffer_append_char(&buffer, '-');
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(&buffer, effective_slug);
    }
    if (rc != SQLITE_OK) {
        text_buffer_reset(&buffer);
        return NULL;
    }
    return buffer.data;
}

static char *build_post_filename(sqlite3_int64 id, const char *slug) {
    TextBuffer buffer = {0};
    char *segment = build_post_segment(id, slug);
    int rc;

    if (segment == NULL) {
        return NULL;
    }
    rc = text_buffer_append(&buffer, segment);
    free(segment);
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(&buffer, ".md");
    }
    if (rc != SQLITE_OK) {
        text_buffer_reset(&buffer);
        return NULL;
    }
    return buffer.data;
}

static char *join_path(const char *root, const char *filename) {
    TextBuffer buffer = {0};
    int rc;

    rc = text_buffer_append(&buffer, root);
    if (rc == SQLITE_OK && buffer.length > 0 && buffer.data[buffer.length - 1] != '/') {
        rc = text_buffer_append_char(&buffer, '/');
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(&buffer, filename);
    }
    if (rc != SQLITE_OK) {
        text_buffer_reset(&buffer);
        return NULL;
    }
    return buffer.data;
}

static char *slugify_title(const char *title) {
    TextBuffer buffer = {0};
    bool wrote_dash = false;
    const unsigned char *cursor;
    int rc = SQLITE_OK;

    if (title == NULL) {
        return duplicate_string("post");
    }
    for (cursor = (const unsigned char *)title; *cursor != '\0'; cursor++) {
        if (isalnum(*cursor)) {
            rc = text_buffer_append_char(&buffer, (char)tolower(*cursor));
            wrote_dash = false;
        } else if (!wrote_dash && buffer.length > 0) {
            rc = text_buffer_append_char(&buffer, '-');
            wrote_dash = true;
        }
        if (rc != SQLITE_OK) {
            text_buffer_reset(&buffer);
            return NULL;
        }
    }
    while (buffer.length > 0 && buffer.data[buffer.length - 1] == '-') {
        buffer.data[--buffer.length] = '\0';
    }
    if (buffer.length == 0) {
        text_buffer_reset(&buffer);
        return duplicate_string("post");
    }
    return buffer.data;
}

static bool is_valid_post_name(const char *slug) {
    const unsigned char *cursor;

    if (slug == NULL || *slug == '\0') {
        return false;
    }
    if (strcmp(slug, ".") == 0 || strcmp(slug, "..") == 0) {
        return false;
    }

    for (cursor = (const unsigned char *)slug; *cursor != '\0'; cursor++) {
        if (*cursor == '/' || *cursor == '\\') {
            return false;
        }
        if (*cursor < 32) {
            return false;
        }
    }

    return true;
}

static int ensure_directory_exists(const char *path) {
    struct stat st;

    if (stat(path, &st) == 0) {
        return S_ISDIR(st.st_mode) ? SQLITE_OK : SQLITE_CANTOPEN;
    }
    if (mkdir(path, 0777) == 0 || errno == EEXIST) {
        return SQLITE_OK;
    }
    return SQLITE_CANTOPEN;
}

static int ensure_parent_directories(const char *root, const char *path) {
    const char *cursor = path + strlen(root);
    TextBuffer current = {0};
    int rc;

    rc = text_buffer_append(&current, root);
    if (rc != SQLITE_OK) {
        text_buffer_reset(&current);
        return rc;
    }
    while (*cursor == '/') {
        cursor++;
    }
    while (*cursor != '\0') {
        const char *slash = strchr(cursor, '/');
        if (slash == NULL) {
            break;
        }
        rc = text_buffer_append_char(&current, '/');
        if (rc == SQLITE_OK) {
            rc = text_buffer_append_raw(&current, cursor, (size_t)(slash - cursor));
        }
        if (rc != SQLITE_OK) {
            text_buffer_reset(&current);
            return rc;
        }
        rc = ensure_directory_exists(current.data);
        if (rc != SQLITE_OK) {
            text_buffer_reset(&current);
            return rc;
        }
        cursor = slash + 1;
    }
    text_buffer_reset(&current);
    return SQLITE_OK;
}

static void remove_empty_parent_directories(const char *root, const char *path) {
    char *current = duplicate_string(path);

    if (current == NULL) {
        return;
    }
    while (current != NULL) {
        char *slash = strrchr(current, '/');
        struct stat st;
        DIR *directory;
        struct dirent *entry;
        bool has_visible_entries = false;

        if (slash == NULL || strcmp(current, root) == 0) {
            break;
        }
        *slash = '\0';
        if (strcmp(current, root) == 0) {
            break;
        }
        if (stat(current, &st) != 0 || !S_ISDIR(st.st_mode)) {
            break;
        }
        directory = opendir(current);
        if (directory == NULL) {
            break;
        }
        while ((entry = readdir(directory)) != NULL) {
            if (strcmp(entry->d_name, ".") != 0 && strcmp(entry->d_name, "..") != 0) {
                has_visible_entries = true;
                break;
            }
        }
        closedir(directory);
        if (has_visible_entries || rmdir(current) != 0) {
            break;
        }
    }
    free(current);
}

static int build_post_path(
    const char *root,
    Dataset *dataset,
    const PostRecord *post,
    const char *slug,
    char **path
) {
    TextBuffer buffer = {0};
    const PostRecord *current;
    const PostRecord *stack[256];
    int depth = 0;
    int index;
    int rc;

    *path = NULL;
    rc = text_buffer_append(&buffer, root);
    if (rc != SQLITE_OK) {
        text_buffer_reset(&buffer);
        return rc;
    }

    if (post->use_index_path) {
        current = post;
        while (current != NULL) {
            if (depth >= (int)(sizeof(stack) / sizeof(stack[0]))) {
                text_buffer_reset(&buffer);
                return SQLITE_CONSTRAINT;
            }
            stack[depth++] = current;
            if (current->post_parent == 0) {
                current = NULL;
            } else {
                current = find_post_by_id(dataset, current->post_parent);
            }
        }
        for (index = depth - 1; index >= 0 && rc == SQLITE_OK; index--) {
            char *segment = build_post_segment(
                stack[index]->id,
                index == 0 ? slug : stack[index]->post_name
            );
            if (segment == NULL) {
                rc = SQLITE_NOMEM;
                break;
            }
            rc = text_buffer_append_char(&buffer, '/');
            if (rc == SQLITE_OK) {
                rc = text_buffer_append(&buffer, segment);
            }
            free(segment);
        }
        if (rc == SQLITE_OK) {
            rc = text_buffer_append(&buffer, "/index.md");
        }
    } else {
        char *filename = build_post_filename(post->id, slug);
        if (filename == NULL) {
            text_buffer_reset(&buffer);
            return SQLITE_NOMEM;
        }
        rc = text_buffer_append_char(&buffer, '/');
        if (rc == SQLITE_OK) {
            rc = text_buffer_append(&buffer, filename);
        }
        free(filename);
    }

    if (rc != SQLITE_OK) {
        text_buffer_reset(&buffer);
        return rc;
    }
    *path = buffer.data;
    return SQLITE_OK;
}

static int write_post_record(const char *root, Dataset *dataset, PostRecord *post, const char *old_path) {
    TextBuffer buffer = {0};
    char number[32];
    char *slug = NULL;
    char *path = NULL;
    PostRecord *parent = NULL;
    int index;
    int rc = SQLITE_OK;

    slug = post->post_name != NULL && *post->post_name != '\0'
        ? duplicate_string(post->post_name)
        : slugify_title(post->post_title);
    if (slug == NULL) {
        return SQLITE_NOMEM;
    }
    if (!is_valid_post_name(slug)) {
        free(slug);
        return SQLITE_CONSTRAINT;
    }
    if (post->post_parent != 0) {
        parent = find_post_by_id(dataset, post->post_parent);
        if (parent == NULL) {
            free(slug);
            return SQLITE_CONSTRAINT;
        }
    }
    rc = build_post_path(root, dataset, post, slug, &path);
    if (rc != SQLITE_OK || path == NULL) {
        free(slug);
        return rc == SQLITE_OK ? SQLITE_NOMEM : rc;
    }

    rc = text_buffer_append(&buffer, "---\n");
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_title", post->post_title);
    }
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_name", slug);
    }
    if (rc == SQLITE_OK && parent != NULL) {
        rc = append_key_value(&buffer, "post_parent", parent->post_name);
    }
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_status", post->post_status);
    }
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_type", post->post_type);
    }
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_date_gmt", post->post_date_gmt);
    }
    if (rc == SQLITE_OK) {
        rc = append_key_value(&buffer, "post_modified_gmt", post->post_modified_gmt);
    }
    for (index = 0; rc == SQLITE_OK && index < post->meta_count; index++) {
        rc = text_buffer_append(&buffer, "[[meta]]\n");
        if (rc != SQLITE_OK) {
            break;
        }
        rc = append_meta_key_value(
            &buffer,
            post->meta_entries[index].meta_key,
            post->meta_entries[index].meta_value
        );
        if (rc != SQLITE_OK) {
            break;
        }
        snprintf(number, sizeof(number), "%lld", (long long)post->meta_entries[index].meta_id);
        rc = text_buffer_append(&buffer, "meta_id = ");
        if (rc == SQLITE_OK) {
            rc = text_buffer_append(&buffer, number);
        }
        if (rc == SQLITE_OK) {
            rc = text_buffer_append_char(&buffer, '\n');
        }
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(&buffer, "---\n");
    }
    if (rc == SQLITE_OK) {
        rc = text_buffer_append(&buffer, post->post_content == NULL ? "" : post->post_content);
    }
    if (rc == SQLITE_OK) {
        rc = ensure_parent_directories(root, path);
    }
    if (rc == SQLITE_OK) {
        /* Skip the write entirely when the on-disk bytes already match what we
         * would produce. This avoids touching files (and their mtimes) when an
         * UPDATE leaves the rendered markdown identical — e.g. a no-op write
         * or a tool re-issuing the same row values. */
        char *existing = NULL;
        size_t existing_length = 0;
        int read_rc = read_text_file(path, &existing, &existing_length);
        bool unchanged = read_rc == SQLITE_OK
            && existing_length == buffer.length
            && (buffer.length == 0 || memcmp(existing, buffer.data, buffer.length) == 0);
        free(existing);
        if (!unchanged) {
            rc = write_text_file_atomic(path, buffer.data, buffer.length);
        }
    }
    if (rc == SQLITE_OK && old_path != NULL && strcmp(old_path, path) != 0) {
        unlink(old_path);
        remove_empty_parent_directories(root, old_path);
    }
    if (rc == SQLITE_OK) {
        free(post->path);
        post->path = duplicate_string(path);
        if (post->path == NULL) {
            rc = SQLITE_NOMEM;
        }
    }

    free(slug);
    free(path);
    text_buffer_reset(&buffer);
    return rc;
}

static PostRecord *find_post_by_id(Dataset *dataset, sqlite3_int64 id) {
    int index;

    for (index = 0; index < dataset->count; index++) {
        if (dataset->posts[index].id == id) {
            return &dataset->posts[index];
        }
    }
    return NULL;
}

static bool post_id_exists(Dataset *dataset, sqlite3_int64 id) {
    return find_post_by_id(dataset, id) != NULL;
}

static bool meta_id_exists(Dataset *dataset, sqlite3_int64 meta_id) {
    int post_index;
    int meta_index;

    for (post_index = 0; post_index < dataset->count; post_index++) {
        for (meta_index = 0; meta_index < dataset->posts[post_index].meta_count; meta_index++) {
            if (dataset->posts[post_index].meta_entries[meta_index].meta_id == meta_id) {
                return true;
            }
        }
    }
    return false;
}

static int remove_meta_at(PostRecord *post, int index) {
    if (index < 0 || index >= post->meta_count) {
        return SQLITE_RANGE;
    }
    free_meta_entry(&post->meta_entries[index]);
    if (index + 1 < post->meta_count) {
        memmove(
            &post->meta_entries[index],
            &post->meta_entries[index + 1],
            sizeof(MetaEntry) * (size_t)(post->meta_count - index - 1)
        );
    }
    post->meta_count--;
    return SQLITE_OK;
}

static int value_to_heap_string(sqlite3_value *value, char **output) {
    const unsigned char *text;

    if (sqlite3_value_type(value) == SQLITE_NULL) {
        *output = NULL;
        return SQLITE_OK;
    }
    text = sqlite3_value_text(value);
    if (text == NULL) {
        return SQLITE_NOMEM;
    }
    *output = duplicate_string((const char *)text);
    if (*output == NULL) {
        return SQLITE_NOMEM;
    }
    return SQLITE_OK;
}

static int update_post_from_values(PostRecord *post, sqlite3_value **values) {
    char *title = NULL;
    char *name = NULL;
    char *status = NULL;
    char *type = NULL;
    char *date_gmt = NULL;
    char *modified_gmt = NULL;
    char *content = NULL;
    sqlite3_int64 post_parent = 0;
    int rc = SQLITE_OK;

    if (sqlite3_value_type(values[POST_COL_PARENT]) != SQLITE_NULL) {
        post_parent = sqlite3_value_int64(values[POST_COL_PARENT]);
        if (post_parent < 0) {
            return SQLITE_CONSTRAINT;
        }
    }

    rc = value_to_heap_string(values[POST_COL_TITLE], &title);
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_NAME], &name);
    }
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_STATUS], &status);
    }
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_TYPE], &type);
    }
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_DATE_GMT], &date_gmt);
    }
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_MODIFIED_GMT], &modified_gmt);
    }
    if (rc == SQLITE_OK) {
        rc = value_to_heap_string(values[POST_COL_CONTENT], &content);
    }
    if (rc != SQLITE_OK) {
        free(title);
        free(name);
        free(status);
        free(type);
        free(date_gmt);
        free(modified_gmt);
        free(content);
        return rc;
    }

    free(post->post_title);
    free(post->post_name);
    free(post->post_status);
    free(post->post_type);
    free(post->post_date_gmt);
    free(post->post_modified_gmt);
    free(post->post_content);
    free(post->post_parent_slug_ref);
    post->post_parent = post_parent;
    post->post_title = title;
    post->post_name = name;
    post->post_status = status;
    post->post_type = type;
    post->post_date_gmt = date_gmt;
    post->post_modified_gmt = modified_gmt;
    post->post_content = content;
    post->post_parent_slug_ref = NULL;
    return SQLITE_OK;
}

static int posts_vtab_connect(sqlite3 *db, void *aux, int argc, const char *const *argv, sqlite3_vtab **pp_vtab, char **pz_err) {
    PostsTable *table;
    const char *schema = "CREATE TABLE x("
        "ID INTEGER PRIMARY KEY,"
        "post_parent INTEGER,"
        "post_title TEXT,"
        "post_name TEXT,"
        "post_status TEXT,"
        "post_type TEXT,"
        "post_date_gmt TEXT,"
        "post_modified_gmt TEXT,"
        "post_content TEXT"
        ")";
    int rc;
    int index;

    (void)aux;
    rc = sqlite3_declare_vtab(db, schema);
    if (rc != SQLITE_OK) {
        return rc;
    }

    table = sqlite3_malloc64(sizeof(*table));
    if (table == NULL) {
        return SQLITE_NOMEM;
    }
    memset(table, 0, sizeof(*table));

    for (index = 3; index < argc; index++) {
        char *trimmed = trim_copy(argv[index]);
        if (trimmed == NULL) {
            sqlite3_free(table);
            return SQLITE_NOMEM;
        }
        if (strncmp(trimmed, "root", 4) == 0) {
            char *key = NULL;
            char *value = NULL;
            rc = parse_assignment(trimmed, &key, &value);
            free(trimmed);
            if (rc != SQLITE_OK) {
                sqlite3_free(table);
                return rc;
            }
            if (strcmp(key, "root") == 0) {
                rc = decode_quoted_value(value, &table->root);
            } else {
                rc = SQLITE_ERROR;
            }
            free(key);
            free(value);
            if (rc != SQLITE_OK) {
                sqlite3_free(table);
                return rc;
            }
            break;
        }
        free(trimmed);
    }

    if (table->root == NULL) {
        *pz_err = sqlite3_mprintf("markdown_posts requires root='...'");
        sqlite3_free(table);
        return SQLITE_ERROR;
    }

    *pp_vtab = &table->base;
    return SQLITE_OK;
}

static int posts_vtab_disconnect(sqlite3_vtab *p_vtab) {
    PostsTable *table = (PostsTable *)p_vtab;
    free(table->root);
    sqlite3_free(table);
    return SQLITE_OK;
}

static int posts_vtab_best_index(sqlite3_vtab *p_vtab, sqlite3_index_info *index_info) {
    (void)p_vtab;
    index_info->estimatedCost = 1000.0;
    index_info->estimatedRows = 1000;
    return SQLITE_OK;
}

static int posts_vtab_open(sqlite3_vtab *p_vtab, sqlite3_vtab_cursor **pp_cursor) {
    PostsCursor *cursor = sqlite3_malloc64(sizeof(*cursor));
    if (cursor == NULL) {
        return SQLITE_NOMEM;
    }
    memset(cursor, 0, sizeof(*cursor));
    dataset_init(&cursor->dataset);
    *pp_cursor = &cursor->base;
    (void)p_vtab;
    return SQLITE_OK;
}

static int posts_vtab_close(sqlite3_vtab_cursor *cur) {
    PostsCursor *cursor = (PostsCursor *)cur;
    dataset_reset(&cursor->dataset);
    sqlite3_free(cursor);
    return SQLITE_OK;
}

static int posts_vtab_filter(sqlite3_vtab_cursor *cur, int idx_num, const char *idx_str, int argc, sqlite3_value **argv) {
    PostsCursor *cursor = (PostsCursor *)cur;
    PostsTable *table = (PostsTable *)cur->pVtab;
    int rc;

    (void)idx_num;
    (void)idx_str;
    (void)argc;
    (void)argv;

    dataset_reset(&cursor->dataset);
    rc = load_dataset(table->root, &cursor->dataset);
    if (rc != SQLITE_OK) {
        return rc;
    }
    cursor->index = 0;
    return SQLITE_OK;
}

static int posts_vtab_next(sqlite3_vtab_cursor *cur) {
    PostsCursor *cursor = (PostsCursor *)cur;
    cursor->index++;
    return SQLITE_OK;
}

static int posts_vtab_eof(sqlite3_vtab_cursor *cur) {
    PostsCursor *cursor = (PostsCursor *)cur;
    return cursor->index >= cursor->dataset.count;
}

static int posts_vtab_column(sqlite3_vtab_cursor *cur, sqlite3_context *ctx, int column) {
    PostsCursor *cursor = (PostsCursor *)cur;
    PostRecord *post = &cursor->dataset.posts[cursor->index];

    switch (column) {
        case POST_COL_ID:
            sqlite3_result_int64(ctx, post->id);
            break;
        case POST_COL_PARENT:
            sqlite3_result_int64(ctx, post->post_parent);
            break;
        case POST_COL_TITLE:
            sqlite3_result_text(ctx, post->post_title, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_NAME:
            sqlite3_result_text(ctx, post->post_name, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_STATUS:
            sqlite3_result_text(ctx, post->post_status, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_TYPE:
            sqlite3_result_text(ctx, post->post_type, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_DATE_GMT:
            sqlite3_result_text(ctx, post->post_date_gmt, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_MODIFIED_GMT:
            sqlite3_result_text(ctx, post->post_modified_gmt, -1, SQLITE_TRANSIENT);
            break;
        case POST_COL_CONTENT:
            sqlite3_result_text(ctx, post->post_content, -1, SQLITE_TRANSIENT);
            break;
        default:
            sqlite3_result_null(ctx);
            break;
    }
    return SQLITE_OK;
}

static int posts_vtab_rowid(sqlite3_vtab_cursor *cur, sqlite3_int64 *rowid) {
    PostsCursor *cursor = (PostsCursor *)cur;
    *rowid = cursor->dataset.posts[cursor->index].id;
    return SQLITE_OK;
}

static int posts_vtab_update(sqlite3_vtab *p_vtab, int argc, sqlite3_value **argv, sqlite3_int64 *p_rowid) {
    PostsTable *table = (PostsTable *)p_vtab;
    Dataset dataset;
    int rc;

    dataset_init(&dataset);
    rc = load_dataset(table->root, &dataset);
    if (rc != SQLITE_OK) {
        return rc;
    }

    if (argc == 1) {
        sqlite3_int64 old_id = sqlite3_value_int64(argv[0]);
        PostRecord *post = find_post_by_id(&dataset, old_id);
        if (post == NULL) {
            dataset_reset(&dataset);
            return SQLITE_NOTFOUND;
        }
        if (unlink(post->path) != 0) {
            dataset_reset(&dataset);
            return SQLITE_IOERR_DELETE;
        }
        remove_empty_parent_directories(table->root, post->path);
    } else if (sqlite3_value_type(argv[0]) == SQLITE_NULL) {
        PostRecord post;
        sqlite3_int64 explicit_id = 0;
        sqlite3_int64 inserted_id;
        sqlite3_value **values = &argv[2];

        memset(&post, 0, sizeof(post));
        if (sqlite3_value_type(values[POST_COL_ID]) != SQLITE_NULL) {
            explicit_id = sqlite3_value_int64(values[POST_COL_ID]);
        }
        inserted_id = explicit_id > 0 ? explicit_id : dataset.max_post_id + 1;
        post.id = inserted_id;
        if (post_id_exists(&dataset, post.id)) {
            dataset_reset(&dataset);
            return SQLITE_CONSTRAINT;
        }
        rc = update_post_from_values(&post, values);
        if (rc == SQLITE_OK) {
            PostRecord *inserted_post;

            rc = append_post_slot(&dataset, &inserted_post);
            if (rc == SQLITE_OK) {
                *inserted_post = post;
                memset(&post, 0, sizeof(post));
                rc = validate_post_hierarchy(&dataset);
            }
            if (rc == SQLITE_OK) {
                rc = write_post_record(table->root, &dataset, inserted_post, NULL);
            }
        }
        free_post_record(&post);
        if (rc != SQLITE_OK) {
            dataset_reset(&dataset);
            return rc;
        }
        *p_rowid = inserted_id;
    } else {
        sqlite3_int64 old_id = sqlite3_value_int64(argv[0]);
        sqlite3_int64 new_id = sqlite3_value_type(argv[1]) == SQLITE_NULL
            ? old_id
            : sqlite3_value_int64(argv[1]);
        PostRecord *post = find_post_by_id(&dataset, old_id);
        sqlite3_value **values = &argv[2];
        char *old_path = NULL;

        if (post == NULL) {
            dataset_reset(&dataset);
            return SQLITE_NOTFOUND;
        }
        if (sqlite3_value_type(values[POST_COL_ID]) != SQLITE_NULL) {
            new_id = sqlite3_value_int64(values[POST_COL_ID]);
        }
        if (new_id <= 0) {
            dataset_reset(&dataset);
            return SQLITE_CONSTRAINT;
        }
        if (new_id != old_id && post_id_exists(&dataset, new_id)) {
            dataset_reset(&dataset);
            return SQLITE_CONSTRAINT;
        }
        old_path = duplicate_string(post->path);
        if (old_path == NULL) {
            dataset_reset(&dataset);
            return SQLITE_NOMEM;
        }
        post->id = new_id;
        rc = update_post_from_values(post, values);
        if (rc == SQLITE_OK) {
            rc = validate_post_hierarchy(&dataset);
        }
        if (rc == SQLITE_OK) {
            rc = write_post_record(table->root, &dataset, post, old_path);
        }
        free(old_path);
        if (rc != SQLITE_OK) {
            dataset_reset(&dataset);
            return rc;
        }
        *p_rowid = new_id;
    }

    dataset_reset(&dataset);
    return SQLITE_OK;
}

static sqlite3_module PostsModule = {
    .iVersion = 4,
    .xCreate = posts_vtab_connect,
    .xConnect = posts_vtab_connect,
    .xBestIndex = posts_vtab_best_index,
    .xDisconnect = posts_vtab_disconnect,
    .xDestroy = posts_vtab_disconnect,
    .xOpen = posts_vtab_open,
    .xClose = posts_vtab_close,
    .xFilter = posts_vtab_filter,
    .xNext = posts_vtab_next,
    .xEof = posts_vtab_eof,
    .xColumn = posts_vtab_column,
    .xRowid = posts_vtab_rowid,
    .xUpdate = posts_vtab_update,
    .xBegin = NULL,
    .xSync = NULL,
    .xCommit = NULL,
    .xRollback = NULL,
    .xFindFunction = NULL,
    .xRename = NULL,
    .xSavepoint = NULL,
    .xRelease = NULL,
    .xRollbackTo = NULL,
    .xShadowName = NULL,
    .xIntegrity = NULL
};

static int postmeta_vtab_connect(sqlite3 *db, void *aux, int argc, const char *const *argv, sqlite3_vtab **pp_vtab, char **pz_err) {
    PostMetaTable *table;
    const char *schema = "CREATE TABLE x("
        "meta_id INTEGER PRIMARY KEY,"
        "post_id INTEGER,"
        "meta_key TEXT,"
        "meta_value TEXT"
        ")";
    int rc;
    int index;

    (void)aux;
    rc = sqlite3_declare_vtab(db, schema);
    if (rc != SQLITE_OK) {
        return rc;
    }

    table = sqlite3_malloc64(sizeof(*table));
    if (table == NULL) {
        return SQLITE_NOMEM;
    }
    memset(table, 0, sizeof(*table));

    for (index = 3; index < argc; index++) {
        char *trimmed = trim_copy(argv[index]);
        if (trimmed == NULL) {
            sqlite3_free(table);
            return SQLITE_NOMEM;
        }
        if (strncmp(trimmed, "root", 4) == 0) {
            char *key = NULL;
            char *value = NULL;
            rc = parse_assignment(trimmed, &key, &value);
            free(trimmed);
            if (rc != SQLITE_OK) {
                sqlite3_free(table);
                return rc;
            }
            if (strcmp(key, "root") == 0) {
                rc = decode_quoted_value(value, &table->root);
            } else {
                rc = SQLITE_ERROR;
            }
            free(key);
            free(value);
            if (rc != SQLITE_OK) {
                sqlite3_free(table);
                return rc;
            }
            break;
        }
        free(trimmed);
    }

    if (table->root == NULL) {
        *pz_err = sqlite3_mprintf("markdown_postmeta requires root='...'");
        sqlite3_free(table);
        return SQLITE_ERROR;
    }

    *pp_vtab = &table->base;
    return SQLITE_OK;
}

static int postmeta_vtab_disconnect(sqlite3_vtab *p_vtab) {
    PostMetaTable *table = (PostMetaTable *)p_vtab;
    free(table->root);
    sqlite3_free(table);
    return SQLITE_OK;
}

static int postmeta_vtab_best_index(sqlite3_vtab *p_vtab, sqlite3_index_info *index_info) {
    (void)p_vtab;
    index_info->estimatedCost = 1000.0;
    index_info->estimatedRows = 1000;
    return SQLITE_OK;
}

static int postmeta_vtab_open(sqlite3_vtab *p_vtab, sqlite3_vtab_cursor **pp_cursor) {
    PostMetaCursor *cursor = sqlite3_malloc64(sizeof(*cursor));
    if (cursor == NULL) {
        return SQLITE_NOMEM;
    }
    memset(cursor, 0, sizeof(*cursor));
    dataset_init(&cursor->dataset);
    *pp_cursor = &cursor->base;
    (void)p_vtab;
    return SQLITE_OK;
}

static int postmeta_vtab_close(sqlite3_vtab_cursor *cur) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    dataset_reset(&cursor->dataset);
    free(cursor->rows);
    sqlite3_free(cursor);
    return SQLITE_OK;
}

static int postmeta_vtab_filter(sqlite3_vtab_cursor *cur, int idx_num, const char *idx_str, int argc, sqlite3_value **argv) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    PostMetaTable *table = (PostMetaTable *)cur->pVtab;
    int post_index;
    int meta_index;
    int row_count = 0;
    int rc;

    (void)idx_num;
    (void)idx_str;
    (void)argc;
    (void)argv;

    dataset_reset(&cursor->dataset);
    free(cursor->rows);
    cursor->rows = NULL;
    cursor->row_count = 0;

    rc = load_dataset(table->root, &cursor->dataset);
    if (rc != SQLITE_OK) {
        return rc;
    }
    for (post_index = 0; post_index < cursor->dataset.count; post_index++) {
        row_count += cursor->dataset.posts[post_index].meta_count;
    }
    if (row_count > 0) {
        cursor->rows = malloc(sizeof(MetaRowRef) * (size_t)row_count);
        if (cursor->rows == NULL) {
            return SQLITE_NOMEM;
        }
        row_count = 0;
        for (post_index = 0; post_index < cursor->dataset.count; post_index++) {
            for (meta_index = 0; meta_index < cursor->dataset.posts[post_index].meta_count; meta_index++) {
                cursor->rows[row_count].post_index = post_index;
                cursor->rows[row_count].meta_index = meta_index;
                row_count++;
            }
        }
    }
    cursor->row_count = row_count;
    cursor->index = 0;
    return SQLITE_OK;
}

static int postmeta_vtab_next(sqlite3_vtab_cursor *cur) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    cursor->index++;
    return SQLITE_OK;
}

static int postmeta_vtab_eof(sqlite3_vtab_cursor *cur) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    return cursor->index >= cursor->row_count;
}

static int postmeta_vtab_column(sqlite3_vtab_cursor *cur, sqlite3_context *ctx, int column) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    MetaRowRef *row = &cursor->rows[cursor->index];
    PostRecord *post = &cursor->dataset.posts[row->post_index];
    MetaEntry *meta = &post->meta_entries[row->meta_index];

    switch (column) {
        case META_COL_ID:
            sqlite3_result_int64(ctx, meta->meta_id);
            break;
        case META_COL_POST_ID:
            sqlite3_result_int64(ctx, post->id);
            break;
        case META_COL_KEY:
            sqlite3_result_text(ctx, meta->meta_key, -1, SQLITE_TRANSIENT);
            break;
        case META_COL_VALUE:
            sqlite3_result_text(ctx, meta->meta_value, -1, SQLITE_TRANSIENT);
            break;
        default:
            sqlite3_result_null(ctx);
            break;
    }
    return SQLITE_OK;
}

static int postmeta_vtab_rowid(sqlite3_vtab_cursor *cur, sqlite3_int64 *rowid) {
    PostMetaCursor *cursor = (PostMetaCursor *)cur;
    MetaRowRef *row = &cursor->rows[cursor->index];
    *rowid = cursor->dataset.posts[row->post_index].meta_entries[row->meta_index].meta_id;
    return SQLITE_OK;
}

static int postmeta_vtab_update(sqlite3_vtab *p_vtab, int argc, sqlite3_value **argv, sqlite3_int64 *p_rowid) {
    PostMetaTable *table = (PostMetaTable *)p_vtab;
    Dataset dataset;
    int rc;

    dataset_init(&dataset);
    rc = load_dataset(table->root, &dataset);
    if (rc != SQLITE_OK) {
        return rc;
    }

    if (argc == 1) {
        sqlite3_int64 old_meta_id = sqlite3_value_int64(argv[0]);
        int post_index;
        int meta_index;
        bool found = false;

        for (post_index = 0; post_index < dataset.count && !found; post_index++) {
            PostRecord *post = &dataset.posts[post_index];
            for (meta_index = 0; meta_index < post->meta_count; meta_index++) {
                if (post->meta_entries[meta_index].meta_id == old_meta_id) {
                    char *old_path = duplicate_string(post->path);
                    if (old_path == NULL) {
                        dataset_reset(&dataset);
                        return SQLITE_NOMEM;
                    }
                    remove_meta_at(post, meta_index);
                    rc = write_post_record(table->root, &dataset, post, old_path);
                    free(old_path);
                    if (rc != SQLITE_OK) {
                        dataset_reset(&dataset);
                        return rc;
                    }
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            dataset_reset(&dataset);
            return SQLITE_NOTFOUND;
        }
    } else if (sqlite3_value_type(argv[0]) == SQLITE_NULL) {
        sqlite3_value **values = &argv[2];
        sqlite3_int64 meta_id = sqlite3_value_type(values[META_COL_ID]) == SQLITE_NULL
            ? dataset.max_meta_id + 1
            : sqlite3_value_int64(values[META_COL_ID]);
        sqlite3_int64 post_id = sqlite3_value_int64(values[META_COL_POST_ID]);
        PostRecord *post = find_post_by_id(&dataset, post_id);
        MetaEntry *meta;
        char *old_path;

        if (post == NULL || meta_id <= 0 || meta_id_exists(&dataset, meta_id)) {
            dataset_reset(&dataset);
            return SQLITE_CONSTRAINT;
        }
        rc = append_meta_slot(post, &meta);
        if (rc != SQLITE_OK) {
            dataset_reset(&dataset);
            return rc;
        }
        meta->meta_id = meta_id;
        rc = value_to_heap_string(values[META_COL_KEY], &meta->meta_key);
        if (rc == SQLITE_OK) {
            rc = value_to_heap_string(values[META_COL_VALUE], &meta->meta_value);
        }
        if (rc != SQLITE_OK || meta->meta_key == NULL) {
            dataset_reset(&dataset);
            return rc == SQLITE_OK ? SQLITE_CONSTRAINT : rc;
        }
        old_path = duplicate_string(post->path);
        if (old_path == NULL) {
            dataset_reset(&dataset);
            return SQLITE_NOMEM;
        }
        rc = write_post_record(table->root, &dataset, post, old_path);
        free(old_path);
        if (rc != SQLITE_OK) {
            dataset_reset(&dataset);
            return rc;
        }
        *p_rowid = meta_id;
    } else {
        sqlite3_int64 old_meta_id = sqlite3_value_int64(argv[0]);
        sqlite3_value **values = &argv[2];
        sqlite3_int64 new_meta_id = sqlite3_value_type(values[META_COL_ID]) == SQLITE_NULL
            ? old_meta_id
            : sqlite3_value_int64(values[META_COL_ID]);
        sqlite3_int64 new_post_id = sqlite3_value_int64(values[META_COL_POST_ID]);
        int old_post_index;
        int old_meta_index;
        bool found = false;

        for (old_post_index = 0; old_post_index < dataset.count && !found; old_post_index++) {
            for (old_meta_index = 0; old_meta_index < dataset.posts[old_post_index].meta_count; old_meta_index++) {
                if (dataset.posts[old_post_index].meta_entries[old_meta_index].meta_id == old_meta_id) {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            dataset_reset(&dataset);
            return SQLITE_NOTFOUND;
        }
        old_post_index--;
        {
            PostRecord *old_post = &dataset.posts[old_post_index];
            PostRecord *new_post = find_post_by_id(&dataset, new_post_id);
            MetaEntry entry = {0};
            char *old_post_path = NULL;
            char *new_post_path = NULL;

            if (new_post == NULL || new_meta_id <= 0 || (new_meta_id != old_meta_id && meta_id_exists(&dataset, new_meta_id))) {
                dataset_reset(&dataset);
                return SQLITE_CONSTRAINT;
            }

            entry.meta_id = new_meta_id;
            rc = value_to_heap_string(values[META_COL_KEY], &entry.meta_key);
            if (rc == SQLITE_OK) {
                rc = value_to_heap_string(values[META_COL_VALUE], &entry.meta_value);
            }
            if (rc != SQLITE_OK || entry.meta_key == NULL) {
                free_meta_entry(&entry);
                dataset_reset(&dataset);
                return rc == SQLITE_OK ? SQLITE_CONSTRAINT : rc;
            }

            old_post_path = duplicate_string(old_post->path);
            if (old_post_path == NULL) {
                free_meta_entry(&entry);
                dataset_reset(&dataset);
                return SQLITE_NOMEM;
            }
            if (new_post != old_post) {
                new_post_path = duplicate_string(new_post->path);
                if (new_post_path == NULL) {
                    free(old_post_path);
                    free_meta_entry(&entry);
                    dataset_reset(&dataset);
                    return SQLITE_NOMEM;
                }
            }

            remove_meta_at(old_post, old_meta_index);
            if (new_post == old_post) {
                MetaEntry *slot;
                rc = append_meta_slot(new_post, &slot);
                if (rc == SQLITE_OK) {
                    *slot = entry;
                    rc = write_post_record(table->root, &dataset, new_post, old_post_path);
                } else {
                    free_meta_entry(&entry);
                }
            } else {
                MetaEntry *slot;
                rc = append_meta_slot(new_post, &slot);
                if (rc == SQLITE_OK) {
                    *slot = entry;
                    rc = write_post_record(table->root, &dataset, old_post, old_post_path);
                } else {
                    free_meta_entry(&entry);
                }
                if (rc == SQLITE_OK) {
                    rc = write_post_record(table->root, &dataset, new_post, new_post_path);
                }
            }
            free(old_post_path);
            free(new_post_path);
            if (rc != SQLITE_OK) {
                dataset_reset(&dataset);
                return rc;
            }
            *p_rowid = new_meta_id;
        }
    }

    dataset_reset(&dataset);
    return SQLITE_OK;
}

static sqlite3_module PostMetaModule = {
    .iVersion = 4,
    .xCreate = postmeta_vtab_connect,
    .xConnect = postmeta_vtab_connect,
    .xBestIndex = postmeta_vtab_best_index,
    .xDisconnect = postmeta_vtab_disconnect,
    .xDestroy = postmeta_vtab_disconnect,
    .xOpen = postmeta_vtab_open,
    .xClose = postmeta_vtab_close,
    .xFilter = postmeta_vtab_filter,
    .xNext = postmeta_vtab_next,
    .xEof = postmeta_vtab_eof,
    .xColumn = postmeta_vtab_column,
    .xRowid = postmeta_vtab_rowid,
    .xUpdate = postmeta_vtab_update,
    .xBegin = NULL,
    .xSync = NULL,
    .xCommit = NULL,
    .xRollback = NULL,
    .xFindFunction = NULL,
    .xRename = NULL,
    .xSavepoint = NULL,
    .xRelease = NULL,
    .xRollbackTo = NULL,
    .xShadowName = NULL,
    .xIntegrity = NULL
};

int sqlite3_extension_init(sqlite3 *db, char **pz_err_msg, const sqlite3_api_routines *p_api) {
    int rc;

    SQLITE_EXTENSION_INIT2(p_api);
    (void)pz_err_msg;

    rc = sqlite3_create_module_v2(db, "markdown_posts", &PostsModule, NULL, NULL);
    if (rc != SQLITE_OK) {
        return rc;
    }
    rc = sqlite3_create_module_v2(db, "markdown_postmeta", &PostMetaModule, NULL, NULL);
    return rc;
}
