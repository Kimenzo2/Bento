fn main() {
    tauri_build::build();
    link_vcpkg_openssl_on_windows();
}

#[cfg(windows)]
fn link_vcpkg_openssl_on_windows() {
    use std::env;
    use std::path::PathBuf;

    if env::var("SQLCIPHER_STATIC").ok().as_deref() != Some("1") {
        return;
    }

    let lib_dir = env::var_os("SQLCIPHER_LIB_DIR")
        .map(PathBuf::from)
        .or_else(|| {
            let root = env::var_os("VCPKG_ROOT")?;
            let triplet =
                env::var_os("VCPKGRS_TRIPLET").or_else(|| env::var_os("VCPKG_TARGET_TRIPLET"))?;
            Some(
                PathBuf::from(root)
                    .join("installed")
                    .join(PathBuf::from(triplet))
                    .join("lib"),
            )
        });

    let Some(lib_dir) = lib_dir else {
        return;
    };

    println!("cargo:rerun-if-env-changed=SQLCIPHER_STATIC");
    println!("cargo:rerun-if-env-changed=SQLCIPHER_LIB_DIR");
    println!("cargo:rerun-if-env-changed=VCPKG_ROOT");
    println!("cargo:rerun-if-env-changed=VCPKGRS_TRIPLET");
    println!("cargo:rerun-if-env-changed=VCPKG_TARGET_TRIPLET");
    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    println!("cargo:rustc-link-lib=static=libssl");
    println!("cargo:rustc-link-lib=static=libcrypto");
}

#[cfg(not(windows))]
fn link_vcpkg_openssl_on_windows() {}
