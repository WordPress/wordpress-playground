# WordPress in the browser!

![](demo.gif)

## Running the demo

This repository ships with a pre-built demo that you can just run!

1. Clone this repo
2. Start a local PHP server with `php -S 127.0.0.1:8000`
3. Visit http://127.0.0.1:8000/index.html

If you want to build the assembly yourself, follow the instructions below.

## Building the assembly

The entire build process is automated with a bash script:

```bash
./wasm-build-pipeline.sh
```

It builds a docker image with the necessary tools, creates a local WordPress installation, 
and does a few more things.

If you'd like to customize the packaged WordPress installation, study and update
the `./wasm-build-pipeline.sh` script accordingly.


