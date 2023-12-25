#include <stdbool.h>

#ifndef TAG_PROCESSOR_H
#define TAG_PROCESSOR_H

typedef uint32_t offset_t;

enum tp_flags {
    tp_at_match  = 1,
    tp_is_closer = 1 << 1
};

enum tp_attribute_flags {
    tp_is_boolean = 1
};

enum tp_tag_name {
    tp_tag_custom = 0,
    tp_tag_a,
    tp_tag_blockquote,
    tp_tag_div,
    tp_tag_img,
    tp_tag_p,
    tp_tag_q,
    tp_tag_script,
    tp_tag_textarea,
    tp_tag_title
};

#define TP_FLAG(s, f) (0 != (s->flags & f))
#define TP_FLAG_SET(s, f) (s->flags |= f)
#define TP_FLAG_UNSET(s, f) (s->flags &= ~f)

#define LOWERCASE_BIT (0x20)

struct tp_slice {
    char     *string;
    offset_t  start;
    offset_t  length;
};

struct tp_span {
    offset_t start;
    offset_t length;
};

struct tp_attribute {
    struct tp_span span;
    struct tp_span name;
    struct tp_span value;
    uint8_t  flags;
};

struct tp_state {
    char               *html;
    offset_t            html_length;
    char               *output_buffer;
    offset_t            bytes_already_parsed;
    offset_t            bytes_already_copied;

    uint8_t             flags;
    offset_t            tag_name_starts_at;
    offset_t            tag_name_length;
    offset_t            tag_ends_at;

    enum tp_tag_name    tag_name;
    char               *custom_tag_name;

    size_t              attribute_count;
    struct tp_attribute attributes[256];

    bool                did_succeed;
};


struct tp_state tp_new(struct tp_slice);

bool tp_next_tag(struct tp_state *);
struct tp_slice tp_get_attribute(struct tp_state *, struct tp_slice);

bool tp_parse_next_tag(struct tp_state *);
bool tp_parse_next_attribute(struct tp_state *);
bool tp_matches(struct tp_state *);

bool tp_skip_script_data(struct tp_state *);
bool tp_skip_rcdata(struct tp_state *, enum tp_tag_name);
void tp_skip_ws(struct tp_state *);

void tp_after_tag(struct tp_state *);

void tp_dbg(struct tp_state *);
void tp_print_substr(struct tp_state *, offset_t at, offset_t length);

struct tp_slice tp_empty_slice();
struct tp_slice tp_make_slice(char *);

offset_t tp_strpos(struct tp_state *, char c, offset_t offset);
offset_t tp_strposs(struct tp_state *, char *c, offset_t length, offset_t offset);
offset_t tp_strspn_alpha(struct tp_state *s, offset_t starting_at);
offset_t tp_strspn_unquoted_value(struct tp_state *s, offset_t starting_at);
offset_t tp_strspn_no_ws(struct tp_state *s, offset_t starting_at);
offset_t tp_strspn_ws_slash(struct tp_state *s, offset_t starting_at);
offset_t tp_strspn_no_tag_name_ender(struct tp_state *s, offset_t starting_at);
offset_t tp_strspn_no_attribute_name_ender(struct tp_state *s, offset_t starting_at);


#endif
