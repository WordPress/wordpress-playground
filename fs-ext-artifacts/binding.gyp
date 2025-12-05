{
    "targets": [
        {
            "target_name": "fs_ext", 
            "include_dirs" : [ "<!(node -e \"require('nan')\")" ],
            "sources": [
                "fs-ext.cc"
            ]
        }
    ]
}
