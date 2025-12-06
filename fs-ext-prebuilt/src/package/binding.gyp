{
    "targets": [
        {
            "target_name": "fs_ext", 
            "include_dirs" : [ "<!(node -e \"require('nan')\")" ],
            "sources": [
                "fs-ext.cc"
            ],
            "cflags_cc!": [
                "-std=gnu++0x",
                "-std=gnu++11",
                "-std=gnu++14",
                "-std=gnu++17",
                "-std=c++11",
                "-std=c++14",
                "-std=c++17"
            ],
            "cflags_cc": [
                "-std=c++20"
            ],
            "conditions": [
                [ 'OS=="win"', {
                    "msvs_settings": {
                        "VCCLCompilerTool": {
                            "AdditionalOptions!": [ "/std:c++17" ],
                            "AdditionalOptions": [ "/std:c++20" ]
                        }
                    }
                }],
                [ 'OS=="mac"', {
                    "cflags_cc!": [
                        "-std=gnu++0x",
                        "-std=gnu++11",
                        "-std=gnu++14",
                        "-std=gnu++17",
                        "-std=c++11",
                        "-std=c++14",
                        "-std=c++17"
                    ],
                    "cflags_cc": [
                        "-std=c++20"
                    ],
                    "xcode_settings": {
                        "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
                        "CLANG_CXX_LIBRARY": "libc++",
                        "OTHER_CPLUSPLUSFLAGS!": [
                            "-std=gnu++0x",
                            "-std=gnu++11",
                            "-std=gnu++14",
                            "-std=gnu++17",
                            "-std=c++11",
                            "-std=c++14",
                            "-std=c++17"
                        ],
                        "OTHER_CPLUSPLUSFLAGS": [
                            "-std=c++20"
                        ]
                    }
                }]
            ]
        }
    ]
}
