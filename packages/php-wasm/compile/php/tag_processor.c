#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tag_processor.h"

struct tp_state tp_new(struct tp_slice html) {
    struct tp_state s = {
        .html        = html.string,
        .html_length = html.length
    };

    return s;
}

bool tp_next_tag(struct tp_state *s) {
    TP_FLAG_UNSET(s, tp_at_match);

    while (s->bytes_already_parsed < s->html_length) {
        if (false == tp_parse_next_tag(s)) {
            s->bytes_already_parsed = s->html_length;

            return false;
        }

        while (tp_parse_next_attribute(s)) {
            continue;
        }

        offset_t tag_ends_at = tp_strpos(s, '>', s->bytes_already_parsed);
        if (!s->did_succeed) {
            return false;
        }
        s->tag_ends_at          = tag_ends_at;
        s->bytes_already_parsed = tag_ends_at;

        if (tp_matches(s)) {
            return true;
        }

        if (!TP_FLAG(s, tp_is_closer)) {
            bool did_succeed = true;
            if (s->tag_name == tp_tag_script) {
                did_succeed = tp_skip_script_data(s);
            } else if (s->tag_name == tp_tag_textarea) {
                did_succeed = tp_skip_rcdata(s, tp_tag_textarea);
            } else if (s->tag_name == tp_tag_title) {
                did_succeed = tp_skip_rcdata(s, tp_tag_title);
            }

            if (!did_succeed) {
                s->bytes_already_parsed = s->html_length;
                return false;
            }
        }
    }

    return false;
}


struct tp_slice tp_get_attribute(struct tp_state *s, struct tp_slice tag_name) {
    s->did_succeed = false;
    if (!TP_FLAG_SET(s, tp_at_match) || 0 == tag_name.length) {
        return tp_empty_slice();
    }

    for (size_t i = 0; i < s->attribute_count; i++) {
        struct tp_attribute *a = &s->attributes[i];

        if (a->name.length != tag_name.length) {
            continue;
        }

        bool full_match = true;
        for (offset_t n = 0; n < tag_name.length; n++) {
            if (toupper(s->html[a->name.start + n]) != toupper(tag_name.string[n])) {
                full_match = false;
                break;
            }
        }
        if (full_match) {
            struct tp_slice value = {
                .string = s->html,
                .start  = a->value.start,
                .length = a->value.length
            };

            s->did_succeed = true;
            return value;
        }
    }

    return tp_empty_slice();
}

bool tp_parse_next_tag(struct tp_state *s) {
    tp_after_tag(s);

    offset_t at = s->bytes_already_parsed;

    while (at < s->html_length) {
        at = tp_strpos(s, '<', at);
        if (!s->did_succeed) {
            return false;
        }

        if (at < s->html_length && '/' == s->html[at + 1]) {
            TP_FLAG_SET(s, tp_is_closer);
            at++;
        } else {
            TP_FLAG_UNSET(s, tp_is_closer);
        }

        offset_t tag_name_prefix_length = tp_strspn_alpha(s, at + 1);
        if (s->did_succeed && tag_name_prefix_length > 0) {
            at++;
            s->tag_name_length      = tag_name_prefix_length + tp_strspn_no_tag_name_ender(s, at + tag_name_prefix_length);
            s->tag_name_starts_at   = at;
            s->bytes_already_parsed = at + s->tag_name_length;
            return true;
        }

        if (at + 1 >= s->html_length) {
            return false;
        }

        if ('!' == s->html[at + 1]) {
            if (
                s->html_length > at + 3 &&
                '-' == s->html[at + 2] &&
                '-' == s->html[at + 3]
            ) {
                offset_t closer_at = tp_strposs(s, "-->", 3, at + 4);
                if (!s->did_succeed) {
                    return false;
                }
            
                at = closer_at + 3;
                continue;
            }

            if (
                s->html_length > at + 8 &&
                '[' == s->html[at + 2] &&
                'C' == s->html[at + 3] &&
                'D' == s->html[at + 4] &&
                'A' == s->html[at + 5] &&
                'T' == s->html[at + 6] &&
                'A' == s->html[at + 7] &&
                '[' == s->html[at + 8]
            ) {
                offset_t closer_at = tp_strposs(s, "]]>", 3, at + 9);
                if (!s->did_succeed) {
                    return false;
                }

                at = closer_at + 3;
                continue;
            }

            if (
                s->html_length > at + 8 &&
                'D' == (s->html[at + 2] & ~LOWERCASE_BIT) &&
                'O' == (s->html[at + 3] & ~LOWERCASE_BIT) &&
                'C' == (s->html[at + 4] & ~LOWERCASE_BIT) &&
                'T' == (s->html[at + 5] & ~LOWERCASE_BIT) &&
                'Y' == (s->html[at + 6] & ~LOWERCASE_BIT) &&
                'P' == (s->html[at + 7] & ~LOWERCASE_BIT) &&
                'E' == (s->html[at + 8] & ~LOWERCASE_BIT)
            ) {
                offset_t closer_at = tp_strpos(s, '>', at + 9);
                if (!s->did_succeed) {
                    return false;
                }

                at = closer_at + 1;
                continue;
            }

            at = tp_strpos(s, '>', at + 1);
            if (!s->did_succeed) {
                return false;
            }
            continue;
        }

        if ('?' == s->html[at + 1]) {
            offset_t closer_at = tp_strpos(s, '>', at + 2);
            if (!s->did_succeed) {
                return false;
            }

            at = closer_at + 1;
            continue;
        }

        at++;
    }

    return false;
}

bool tp_parse_next_attribute(struct tp_state *s) {
    s->bytes_already_parsed += tp_strspn_ws_slash(s, s->bytes_already_parsed);
    if (s->bytes_already_parsed >= s->html_length) {
        return false;
    }

    offset_t name_length = '=' == s->html[s->bytes_already_parsed]
        ? (1 + tp_strspn_no_attribute_name_ender(s, s->bytes_already_parsed + 1))
        : tp_strspn_no_attribute_name_ender(s, s->bytes_already_parsed);

    if ( 0 == name_length || ((s->bytes_already_parsed + name_length) >= s->html_length)) {
        return false;
    }

    offset_t attribute_start = s->bytes_already_parsed;
    s->bytes_already_parsed += name_length;
    if (s->bytes_already_parsed >= s->html_length) {
        return false;
    }

    tp_skip_ws(s);
    if (s->bytes_already_parsed >= s->html_length) {
        return false;
    }

    bool has_value = '=' == s->html[s->bytes_already_parsed];

    if (s->attribute_count > 255) {
        return false;
    }

    struct tp_attribute *attr = &s->attributes[s->attribute_count++];
    attr->span.start          = attribute_start;
    attr->name.start          = attribute_start;
    attr->name.length         = name_length;

    if (has_value) {
        TP_FLAG_UNSET(attr, tp_is_boolean);
        s->bytes_already_parsed++;
        tp_skip_ws(s);
        if (s->bytes_already_parsed >= s->html_length) {
            return false;
        }

        switch (s->html[s->bytes_already_parsed]) {
            case '"':
            case '\'': {
                char quote         = s->html[s->bytes_already_parsed];
                attr->value.start  = s->bytes_already_parsed + 1;
                offset_t quote_end = tp_strpos(s, quote, attr->value.start);
                if (!s->did_succeed) {
                    return false;
                }
                attr->span.length       = quote_end + 1 - attr->value.start;
                attr->value.length      = quote_end - attr->value.start;
                s->bytes_already_parsed = quote_end + 1;
                break;
            }

            default:
                attr->value.start  = s->bytes_already_parsed;
                attr->value.length = tp_strspn_unquoted_value(s, attr->value.start);
                if (!s->did_succeed) {
                    return false;
                }
                attr->span.length       = (attr->value.start - attr->span.start) + attr->value.length;
                s->bytes_already_parsed = attr->span.start + attr->span.length;
        }
    } else {
        TP_FLAG_SET(attr, tp_is_boolean);
        attr->value.start  = s->bytes_already_parsed;
        attr->value.length = 0;
        attr->span.length  = name_length;
    }

    if (attr->span.start + attr->span.length >= s->html_length) {
        return false;
    }

    return true;
}

bool tp_matches(struct tp_state *s) {
    TP_FLAG_SET(s, tp_at_match);
    return true;
}

bool tp_skip_script_data(struct tp_state *s) {
    return false;
}

bool tp_skip_rcdata(struct tp_state *s, enum tp_tag_name tag) {
    return false;
}

void tp_skip_ws(struct tp_state *s) {
    while (s->bytes_already_parsed < s->html_length) {
        char c = s->html[s->bytes_already_parsed];

        if (' ' == c || '\t' == c || '\f' == c || '\r' == c || '\n' == c) {
            s->bytes_already_parsed++;
        } else {
            return;
        }
    }
}

void tp_after_tag(struct tp_state *s) {
    TP_FLAG_UNSET(s, tp_at_match);
    s->attribute_count = 0;
    memset(s->attributes, 0, 256 * sizeof(struct tp_attribute));
}

//////////////////////
// UTILITY
//////////////////////

struct tp_slice tp_empty_slice() {
    struct tp_slice new_slice = {
        .string = NULL,
        .start  = 0,
        .length = 0
    };

    return new_slice;
}

struct tp_slice tp_make_slice(char *s) {
    struct tp_slice new_slice = {
        .string = s,
        .start  = 0,
        .length = strlen(s)
    };

    return new_slice;
}

offset_t tp_strpos(struct tp_state *s, char c, offset_t starting_at) {
    s->did_succeed = false;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        if (s->html[at] == c) {
            s->did_succeed = true;
            return at;
        }
    }

    return 0;
}

offset_t tp_strposs(struct tp_state *s, char *needle, offset_t needle_length, offset_t starting_at) {
    char last = needle[needle_length - 1];

    offset_t at = starting_at + needle_length;
    while (at < s->html_length) {
        offset_t next = tp_strpos(s, last, at);
        if (!s->did_succeed) {
            return 0;
        }

        for (offset_t i = 1; i < needle_length; i++) {
            if (s->html[next - i] != needle[needle_length - i]) {
                next++;
                break;
            }
        }

        s->did_succeed = true;
        return next - needle_length;
    }

    s->did_succeed = false;
    return 0;
}

offset_t tp_strspn_alpha(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];
        if (!((0x41 <= c && c <= 0x5a) || (0x61 <= c && c <= 0x7a))) {
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}

offset_t tp_strspn_unquoted_value(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];
        if (c == '>' || c == ' ' || c == '\t' || c == '\f' || c == '\r' || c == '\n') {
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}

offset_t tp_strspn_no_ws(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];

        if (c == ' ' || c == '\t' || c == '\f' || c == '\r' || c == '\n') {
            printf("No whitespace: at = %d, %d chars\n", starting_at, at - starting_at);
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}

offset_t tp_strspn_ws_slash(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];

        if (!(c == ' ' || c == '\t' || c == '\f' || c == '\r' || c == '\n' || c == '/')) {
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}

offset_t tp_strspn_no_tag_name_ender(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];

        if (c == '/' || c == '>' || c == ' ' || c == '\t' || c == '\f' || c == '\r' || c == '\n') {
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}

offset_t tp_strspn_no_attribute_name_ender(struct tp_state *s, offset_t starting_at) {
    s->did_succeed = true;

    for (offset_t at = starting_at; at < s->html_length; at++) {
        char c = s->html[at];

        if (c == '=' || c == '/' || c == '>' || c == ' ' || c == '\t' || c == '\f' || c == '\r' || c == '\n') {
            return at - starting_at;
        }
    }

    return s->html_length - starting_at;
}



//////////////////////
// DEBUG
//////////////////////

void tp_dbg(struct tp_state *s) {
    fwrite(s->html, sizeof(char), s->html_length, stdout);
    printf("\n");

    if (0 == s->tag_name_starts_at) {
        return;
    }

    printf("  <");
    tp_print_substr(s, s->tag_name_starts_at, s->tag_name_length);
    printf(" (%ld)>\n", s->attribute_count);

    for (size_t i = 0; i < s->attribute_count; i++) {
        struct tp_attribute *attr = &s->attributes[i];

        printf("    - ");
        tp_print_substr(s, attr->name.start, attr->name.length);
        printf(" : ");
        if (TP_FLAG(attr, tp_is_boolean)) {
            printf("true");
        } else {
            tp_print_substr(s, attr->value.start, attr->value.length);
        }
        printf("\n");
    }
}

void tp_print_substr(struct tp_state *s, offset_t at, offset_t length) {
    offset_t count = ((at + length) >= s->html_length)
        ? (s->html_length - at)
        : length;

    fwrite(s->html + at, sizeof(char), count, stdout);
}

// int main(void) {
//     // printf("0         1         2         3         4         5\n");
//     // printf(" 1234 6789 1234 6789 1234 6789 1234 6789 1234 6789 1234 6789\n");
//     // char *html = "<div class=\"wp-group-block\" id='top'><img src=atat.png lazy srcset=\"2x,atat-512.png\"></div>";
//     // struct tp_state *s = tp_new(tp_make_slice(html));
//     struct tp_slice html = tp_empty_slice();

//     FILE *html_spec = fopen("/Users/cloudnik/www/Automattic/core/plugins/playground/packages/php-wasm/compile/ext-tag-processor/single-page.html", "r");
//     fseek(html_spec, 0, SEEK_END);
//     html.length = ftell(html_spec);
//     rewind(html_spec);

//     html.string = malloc(html.length);
//     fread(html.string, html.length, sizeof(char), html_spec);
//     fclose(html_spec);

//     struct tp_state s = tp_new(html);

//     // tp_dbg(s);
//     long tag_count = 0;
//     while (tp_next_tag(&s)) {
//         tag_count++;
//     }
//     printf("Found %ld tags\n", tag_count);

//     // tp_next_tag(s);
//     // tp_dbg(s);
//     // printf("TP at %d: '", s->tag_name_starts_at);
//     // tp_print_substr(s, s->tag_name_starts_at, s->tag_name_length);
//     // printf("'\n");

//     // tp_next_tag(s);
//     // tp_dbg(s);
//     // printf("TP at %d: '", s->tag_name_starts_at);
//     // tp_print_substr(s, s->tag_name_starts_at, s->tag_name_length);
//     // printf("'\n");

//     // struct tp_slice src = tp_get_attribute(s, tp_make_slice("SRC"));
//     // if (s->did_succeed) {
//     //     printf("  'src' = \"");
//     //     fwrite(&src.string[src.start], sizeof(char), src.length, stdout);
//     //     printf("\"\n");
//     // } else {
//     //     printf("  'src' not found\n");
//     // }

//     // struct tp_slice srcer = tp_get_attribute(s, tp_make_slice("srcer"));
//     // if (s->did_succeed) {
//     //     printf("  'srcer' = \"");
//     //     fwrite(&srcer.string[src.start], sizeof(char), srcer.length, stdout);
//     //     printf("\"\n");
//     // } else {
//     //     printf("  'srcer' not found\n");
//     // }

//     return 0;
// }