#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

#define WASM_MAGIC 0x6D736100
#define WASM_VERSION 0x1

// Section IDs
#define IMPORT_SECTION 2
#define EXPORT_SECTION 7

typedef struct {
    uint32_t magic;
    uint32_t version;
} wasm_header_t;

typedef struct {
    uint8_t id;
    uint32_t size;
} section_header_t;

// Read LEB128 encoded unsigned integer
uint32_t read_leb128(FILE *fp) {
    uint32_t result = 0;
    uint32_t shift = 0;
    uint8_t byte;
    
    do {
        byte = fgetc(fp);
        result |= ((byte & 0x7f) << shift);
        shift += 7;
    } while (byte & 0x80);
    
    return result;
}

// Read string from wasm binary
char* read_string(FILE *fp) {
    uint32_t len = read_leb128(fp);
    char *str = malloc(len + 1);
    fread(str, 1, len, fp);
    str[len] = '\0';
    return str;
}

void parse_imports(FILE *fp) {
    uint32_t count = read_leb128(fp);
    printf("[\n");
    
    for (uint32_t i = 0; i < count; i++) {
        char *module = read_string(fp);
        char *name = read_string(fp);
        uint8_t kind = fgetc(fp);
        
        printf("    {\n");
        printf("      \"module\": \"%s\",\n", module);
        printf("      \"name\": \"%s\",\n", name);
        printf("      \"kind\": \"0x%02x\",\n", kind);
        
        // Parse import type based on kind
        switch(kind) {
            case 0x00: // Function
                printf("      \"type\": \"function\",\n");
                printf("      \"typeIndex\": %d\n", read_leb128(fp));
                break;
            case 0x01: { // Table
                printf("      \"type\": \"table\",\n");
                // Skip table type but include in JSON
                uint8_t elemType = fgetc(fp);
                uint8_t flags = fgetc(fp);
                uint32_t initial = read_leb128(fp);
                printf("      \"elementType\": \"0x%02x\",\n", elemType);
                printf("      \"initial\": %d", initial);
                if (flags & 0x01) {
                    uint32_t max = read_leb128(fp);
                    printf(",\n      \"maximum\": %d\n", max);
                } else {
                    printf("\n");
                }
                break;
            }
            case 0x02: { // Memory
                printf("      \"type\": \"memory\",\n");
                uint8_t flags = fgetc(fp);
                uint32_t initial = read_leb128(fp);
                printf("      \"initial\": %d", initial);
                if (flags & 0x01) {
                    uint32_t max = read_leb128(fp);
                    printf(",\n      \"maximum\": %d\n", max);
                } else {
                    printf("\n");
                }
                break;
            }
            case 0x03: { // Global
                printf("      \"type\": \"global\",\n");
                uint8_t valueType = fgetc(fp);
                uint8_t mutability = fgetc(fp);
                printf("      \"valueType\": \"0x%02x\",\n", valueType);
                printf("      \"mutable\": %s\n", mutability ? "true" : "false");
                break;
            }
        }

        free(module);
        free(name);
        
        if (i < count - 1) {
            printf("    },\n");
        } else {
            printf("    }\n");
        }
    }
    
    printf("  ]");
}

void parse_exports(FILE *fp) {
	printf("[\n");
	
	// Read number of exports
	uint32_t count = read_leb128(fp);
	
	for (uint32_t i = 0; i < count; i++) {
		// Read export name
		uint32_t name_len = read_leb128(fp);
		char* name = malloc(name_len + 1);
		fread(name, 1, name_len, fp);
		name[name_len] = '\0';
		
		// Read export kind and index
		uint8_t kind = fgetc(fp);
		uint32_t index = read_leb128(fp);
		
		printf("    {\n");
		printf("      \"name\": \"%s\",\n", name);
		printf("      \"kind\": %d,\n", kind);
		printf("      \"index\": %d\n", index);
		
		if (i < count - 1) {
			printf("    },\n");
		} else {
			printf("    }\n");
		}
		
		free(name);
	}
	
	printf("  ]");
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <wasm file>\n", argv[0]);
        return 1;
    }
    
    FILE *fp = fopen(argv[1], "rb");
    if (!fp) {
        perror("Failed to open file");
        return 1;
    }
    
    // Read and verify header
    wasm_header_t header;
    fread(&header, sizeof(header), 1, fp);
    
    if (header.magic != WASM_MAGIC || header.version != WASM_VERSION) {
        fprintf(stderr, "Invalid WASM file\n");
        fclose(fp);
        return 1;
    }

    printf("{\n");

    // Find imports and exports sections
    int found_imports = 0;
    int found_exports = 0;
    
    while (!feof(fp) && (!found_imports || !found_exports)) {
        section_header_t section;
        section.id = fgetc(fp);
        if (feof(fp)) break;
        
        section.size = read_leb128(fp);
        
        if (section.id == IMPORT_SECTION) {
            printf("  \"imports\": ");
            parse_imports(fp);
            found_imports = 1;
            if (!found_exports) {
                printf(",");
            }
            printf("\n");
        } else if (section.id == EXPORT_SECTION) {
            printf("  \"exports\": ");
            parse_exports(fp);
            found_exports = 1;
            if (!found_imports) {
                printf(",");
            }
            printf("\n");
        } else {
            // Skip other sections
            fseek(fp, section.size, SEEK_CUR);
        }
    }

    if (!found_imports) {
        printf("  \"imports\": []\n");
    }
    if (!found_exports) {
        printf("  \"exports\": []\n");
    }

    printf("}\n");
    
    fclose(fp);
    return 0;
}
