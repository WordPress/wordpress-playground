from multiprocessing.sharedctypes import Value
from pprint import pprint
from collections import defaultdict


def get_function_meta(wat, name):
    """ Returns the wat function signature

    >>> get_function_meta('''(func $_test (type 6) (result i32)
    ... (local i32 i32 i32)
    ... global.get 16
    ... local.set 2
    ... i32.const 64300
    ... i32.load
    ... local.set 0
    ... local.get 0
    ... return)''', '$_test')
    {'params': [], 'return': ['i32'], 'starts_at': 0, 'ends_at': 137}
    """
    idx = 0
    while True:
        func_declaration = f'(func {name} '
        try:
            idx = wat.index(func_declaration, idx)
        except ValueError:
            raise ValueError(f"Function declaration not found: {name}")
        if wat[idx + len(func_declaration) + 1] == ")":
            continue
        else:
            break
    starts_at = idx

    ends_at = None
    open_parens = 0
    func_body = [func_declaration]
    for i, char in enumerate(wat[starts_at:]):
        func_body.append(char)
        if char == "(":
            open_parens += 1
        elif char == ")":
            open_parens -= 1
        if open_parens == 0:
            ends_at = starts_at + i + 1
            if len(wat) >= ends_at + 1 and wat[ends_at] == "\n":
                ends_at += 1
            break
    func_body = "".join(func_body)

    try:
        _params = func_body.split("(param ")[1].split(")")[0].split(" ")
    except IndexError:
        _params = []

    try:
        _return = [func_body.split("(result ")[1].split(")")[0]]
    except IndexError:
        _return = []

    return {"params": _params, "return": _return, "starts_at": starts_at, "ends_at": ends_at}


def remove_function_calls(wat, fn):
    """ Removes calls of a specific function

    >>> remove_function_calls('''
    ... (func $remove_calls (type 0) 
    ... return)
    ... (func $main (type 6) (result i32)
    ... (local i32 i32 i32)
    ... call $remove_calls
    ... call $remove_calls
    ... return)''', '$remove_calls')
    '\\n(func $remove_calls (type 0) \\nreturn)\\n(func $main (type 6) (result i32)\\n(local i32 i32 i32)\\nreturn)'

    >>> remove_function_calls('''
    ... (func $remove_calls (type 0) (param i32) (result i32) 
    ... return)
    ... (func $main (type 6) (result i32)
    ... (local i32 i32 i32)
    ... local.get 50
    ... call $remove_calls
    ... drop
    ... local.get 50
    ... call $remove_calls
    ... drop
    ... return)''', '$remove_calls')
    '\\n(func $remove_calls (type 0) (param i32) (result i32) \\nreturn)\\n(func $main (type 6) (result i32)\\n(local i32 i32 i32)\\nreturn)'
    """
    meta = get_function_meta(wat, fn)
    new_contents = []
    skip_one = False
    # Assume the instructions are separated by newlines
    for line in wat.split("\n"):
        if skip_one:
            skip_one = False
            continue
        if line.strip() != f'call {fn}':
            new_contents.append(line)
            continue
        for _ in range(len(meta['params'])):
            new_contents.pop()
        if len(meta['return']):
            skip_one = True
    return "\n".join(new_contents)


def remove_function_declaration(wat, fn):
    """ Removes a declaration of a specific function

    >>> remove_function_declaration('''
    ... (func $keep_me_1 (type 0) (param i32) (result i32) 
    ... return)
    ... (func $remove_me (type 0) (param i32) (result i32) 
    ... return)
    ... (func $keep_me_2 (type 0) (param i32) (result i32) 
    ... return)''', '$remove_me')
    '\\n(func $keep_me_1 (type 0) (param i32) (result i32) \\nreturn)\\n(func $keep_me_2 (type 0) (param i32) (result i32) \\nreturn)'
    """
    meta = get_function_meta(wat, fn)
    wat = wat[:meta['starts_at']] + wat[meta['ends_at']:]
    wat = wat.replace(f'(import "env" "_{fn[1:]}" )', '')
    return wat


def remove_function_export(wat, fn):
    """ Removes a global export of a specific function

    >>> remove_function_export('''
    ... (func $remove_me (type 0) (param i32) (result i32) 
    ... return)
    ... (export "_keep_me" (func $_keep_me))
    ... (export "_remove_me" (func $_remove_me))
    ... (elem (;0;) (global.get 1) func $keep_me_1 $_remove_me $_remove_me $keep_me_2)
    ... ''', '$_remove_me')
    '\\n(func $remove_me (type 0) (param i32) (result i32) \\nreturn)\\n(export "_keep_me" (func $_keep_me))\\n\\n(elem (;0;) (global.get 1) func $keep_me_1 $keep_me_2)\\n'
    """
    export_substr = f'(export "{fn[1:]}" (func {fn}))'
    if export_substr in wat:
        found_at = wat.index(export_substr)
        wat = wat[:found_at] + wat[found_at + len(export_substr):]

    exports_prefix = '(elem (;0;) (global.get 1) func'
    try:
        exports_start_at = wat.index(exports_prefix)
    except ValueError:
        return wat
    exports_end_at = wat.index("\n", exports_start_at)
    while True:
        try:
            export_starts_at = wat.index(f'{fn})', exports_start_at)
        except ValueError:
            try:
                export_starts_at = wat.index(f'{fn} ', exports_start_at)
            except ValueError:
                return wat
        if export_starts_at > exports_end_at:
            return wat
        export_ends_at = export_starts_at + len(fn)
        if wat[export_ends_at] == " ":
            export_ends_at += 1

        wat = wat[:export_starts_at] + wat[export_ends_at:]


def call_graph(wat):
    """ Computes a call graph of a WAT file.

    >>> call_graph('''
    ... (func $a (type 0) (param i32) (result i32) 
    ...    call $b
    ...    return)
    ... (func $b (type 0) (param i32) (result i32) 
    ...    return)
    ... ''')
    {'key_calls_values': {'$a': {'$b'}, '$b': set()}, 'keys_called_by_values': {'$a': set(), '$b': {'$a'}}}
    """
    key_calls_values = defaultdict(lambda: set())
    keys_called_by_values = defaultdict(lambda: set())
    fn_name = 'root'
    for line in wat.split("\n"):
        if line.strip()[0:7] == '(func $':
            fn_name = line.split('(func ')[1].split("(")[0].strip()
            # Create entries
            key_calls_values[fn_name]
            keys_called_by_values[fn_name]
        elif line.strip()[0:5] == 'call ':
            called_fn = line.split('call ')[1].strip()
            key_calls_values[fn_name].add(called_fn)
            keys_called_by_values[called_fn].add(fn_name)
    return {
        "key_calls_values": dict(key_calls_values),
        "keys_called_by_values": dict(keys_called_by_values)
    }


def remove_function(wat, fn):
    return remove_function_declaration(remove_function_calls(remove_function_export(wat, fn), fn), fn)


def find_unused_functions(wat, keep=None):
    """
    >>> find_unused_functions('''
    ... (func $i_call_foo (type 0) (param i32)    
    ...    global.get 16
    ...    local.set 2
    ...    call $i_call_foo
    ...    drop
    ...    return)
    ... (func $i_call_bar (type 0) (param i32) (result i32) 
    ...    call $bar
    ...    drop
    ... return)
    ... (func $bar (type 0) (result i32) 
    ... return)
    ... (func $goo (type 0) (result i32) 
    ... return)
    ... (elem (;0;) (global.get 1) func $i_call_foo $i_call_bar $bar $goo)
    ... ''', ['$i_call_bar'])
    {'$goo'}
    """
    if keep is None:
        keep = []
    graph = call_graph(wat)
    removed_fns = set()
    for fn, called_by in graph["keys_called_by_values"].items():
        if len(called_by) == 0 and fn not in keep:
            removed_fns.add(fn)
    return removed_fns


# if __name__ == "__main__":
#     import doctest
#     doctest.testmod()


read_from = 'fix/updated.wat'
write_to = 'fix/updated2.wat'
with open(read_from, 'r') as fp:
    wat = "".join(fp.readlines())

unused_functions = find_unused_functions(wat, ['$_pib_init2'])
print("Removing the following unused functions:")
pprint(unused_functions)
updated_wat = wat
for fn in unused_functions:
    updated_wat = remove_function(updated_wat, fn)

if len(updated_wat):
    with open(write_to, 'w') as fp:
        fp.write(updated_wat)

    with open(read_from, 'w') as fp:
        fp.write(updated_wat)
else:
    print("Resulting WAT file is empty – something wet wrong")
