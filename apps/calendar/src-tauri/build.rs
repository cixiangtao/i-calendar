fn main() {
    println!("cargo:rerun-if-env-changed=I_CALENDAR_UPDATE_ENDPOINT");
    println!("cargo:rerun-if-env-changed=I_CALENDAR_UPDATE_PUBKEY");
    tauri_build::build();
}
