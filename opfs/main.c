#include <assert.h>
#include <dirent.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#include <emscripten/wasmfs.h>
#include <emscripten/console.h>

int main() {
    printf("Hello, OPFS via WASMFS!\n");
    
    backend_t opfs = wasmfs_create_opfs_backend();
    emscripten_console_log("created OPFS backend");
    int err = wasmfs_create_directory("/opfs", 0777, opfs);

    return 0;
}

void create_file() {
    FILE *file = fopen("/opfs/test.txt", "w");
    if (file == NULL) {
        printf("Error: Could not open file\n");
        return;
    }
    fprintf(file, "Hello, OPFS via WASMFS!\n");
    fclose(file);
}
