// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

fn main() {
    // Workaround: DEP_TAURI_DEV is not always propagated when using a
    // custom profile (e.g. `ci`). Default to dev=true to prevent panic.
    if std::env::var_os("DEP_TAURI_DEV").is_none() {
        std::env::set_var("DEP_TAURI_DEV", "true");
    }

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
