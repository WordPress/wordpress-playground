use std::env;
use std::fs::File;
use std::io::copy;
use std::path::PathBuf;

const WORDPRESS_ZIP_RELATIVE_PATH: &str = "../wordpress-builds/src/wordpress/wp-6.9.zip";
const CA_BUNDLE_ENTRY_PATH: &str = "wp-includes/certificates/ca-bundle.crt";

fn main() {
    let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let wordpress_zip_path = manifest_dir.join(WORDPRESS_ZIP_RELATIVE_PATH);
    println!("cargo:rerun-if-changed={}", wordpress_zip_path.display());

    let wordpress_zip = File::open(&wordpress_zip_path).unwrap_or_else(|error| {
        panic!(
            "failed to open WordPress ZIP at {}: {error}",
            wordpress_zip_path.display()
        )
    });
    let mut archive = zip::ZipArchive::new(wordpress_zip)
        .unwrap_or_else(|error| panic!("failed to read WordPress ZIP: {error}"));
    let mut ca_bundle = archive
        .by_name(CA_BUNDLE_ENTRY_PATH)
        .unwrap_or_else(|error| {
            panic!("failed to read {CA_BUNDLE_ENTRY_PATH} from WordPress ZIP: {error}")
        });

    let out_dir = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    let ca_bundle_path = out_dir.join("ca-bundle.crt");
    let mut out = File::create(&ca_bundle_path).unwrap_or_else(|error| {
        panic!(
            "failed to create generated CA bundle at {}: {error}",
            ca_bundle_path.display()
        )
    });
    copy(&mut ca_bundle, &mut out)
        .unwrap_or_else(|error| panic!("failed to extract CA bundle: {error}"));
}
