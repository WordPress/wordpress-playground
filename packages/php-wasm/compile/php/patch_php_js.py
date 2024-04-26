import os
import sys

def replace(content, search, replacement, must_match=True):
    if search in content:
        return content.replace(search, replacement)    
    if must_match:
        print(f"Could not find '{search}' in the file")
        os.exit(1)
    return content

with open(sys.argv[1], 'r+') as file:
    content = file.read()

    content = replace(
        content,
        'assert(original.sig, `Missing __sig for ${x}`);',
        '',
        must_match=False
    )
    content = replace(
        content,
        'let type = sigToWasmTypes(original.sig);',
        '''
            if(!original.sig && x.startsWith("invoke_")) {
                const l = "invoke_".length;
                original.sig = x[l] + "i" + x.slice(l + 1);
            }

            let type = sigToWasmTypes(original.sig);
        '''
    )
    content = replace(
        content, 
        'if (asyncMode) ',
        'if (asyncMode && ret?.then) '
    )

    file.seek(0)
    file.write(content)
    file.truncate()
    
