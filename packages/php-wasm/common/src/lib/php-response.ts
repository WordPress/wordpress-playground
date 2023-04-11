
class PHPResponse {

    readonly headers;
    readonly bytes: Uint8Array;
    readonly exitCode: number;
    readonly stderr;

    constructor(headers, bytes, exitCode, stderr) {
        this.headers = headers;
        this.bytes = bytes;
        this.exitCode = exitCode;
        this.stderr = stderr;
    }

    get json() {
        return JSON.parse(this.text);
    }
    
    get text() {
        return new TextDecoder().decode(this.bytes);
    }

}
