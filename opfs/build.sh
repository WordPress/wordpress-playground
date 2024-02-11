#!/bin/bash

source /root/emsdk/emsdk_env.sh
emcc main.c -o opfs.js \
    -g3 \
    -O0 \
    -sFORCE_FILESYSTEM=1 \
    -sEXPORTED_FUNCTIONS=["_main","_create_file"] \
    -sEXPORTED_RUNTIME_METHODS=["FS","ccall"] \
    -sWASMFS=1 \
    -sASYNCIFY=1 \
    -sASYNCIFY_IGNORE_INDIRECT=1 \
    -sASYNCIFY_ADVISE=1 \
    -sASYNCIFY_IMPORTS=["_main","_create_file","_open","__syscall_openat"] 
    # -sWASM_WORKERS # \
