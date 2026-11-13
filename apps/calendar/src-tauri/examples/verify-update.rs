//! 发布前使用官方 updater 离线验证更新包；MockRuntime 仅用于此开发工具，不进入应用。
#[cfg(target_os = "macos")]
fn verify(
    public_key: &str,
    manifest: serde_json::Value,
    bytes: &[u8],
    target: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({"pubkey": public_key, "requireSignedVersion": true, "endpoints": ["https://example.invalid/latest.json"]}),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)?;
    // 这里只验签，允许验证正在打包的当前版本；生产检查仍使用官方默认的只升不降规则。
    let updater = app
        .updater_builder()
        .target(target)
        .version_comparator(|_, _| true)
        .build()?;
    updater
        .restore_update(manifest)?
        .ok_or("更新清单没有匹配的安装包")?
        .verify(bytes)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() != 4 {
        return Err(
            "用法：verify-update 公钥文件 更新清单 更新包 darwin-aarch64|darwin-x86_64".into(),
        );
    }
    verify(
        std::fs::read_to_string(&args[0])?.trim(),
        serde_json::from_slice(&std::fs::read(&args[1])?)?,
        &std::fs::read(&args[2])?,
        &args[3],
    )?;
    println!("PASS：更新包签名与清单版本一致");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn main() {
    panic!("当前更新分发工具仅支持 Mac");
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};

    // Tauri updater 2.14.1 官方公开测试向量，payload 为 test，不含任何私钥。
    const KEY: &str = "untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe";
    const SIGNATURE: &str = "untrusted comment: signature from tauri secret key\nRUTX5qZvdPSepPF2zsjvP/L/TQtBLRnWRvaq+4omK1UEugtQp/USrGiI1v762sDy3id3aor7bRC9ETyeot6lMHHrWoZ5hjUM1Qc=\ntrusted comment: timestamp:1791649051\tfile:payload\tversion:2.0.0\nDDq2CLOEl5cQmC2eJRHlnZPVViOZsu1CjpPKQoei4A/XBfkDqGO0B+QMrcrHgEQ5qV3mne75tdFWhJpqUXh9AA==";

    fn manifest(version: &str) -> serde_json::Value {
        serde_json::json!({
            "version": version,
            "platforms": {"darwin-aarch64": {
                "url": "https://example.com/update.app.tar.gz",
                "signature": STANDARD.encode(SIGNATURE)
            }}
        })
    }

    #[test]
    fn official_signed_package_passes_but_tampering_and_false_version_fail() {
        let key = STANDARD.encode(KEY);
        verify(&key, manifest("2.0.0"), b"test", "darwin-aarch64").unwrap();
        assert!(verify(&key, manifest("2.0.0"), b"tampered", "darwin-aarch64").is_err());
        assert!(verify(&key, manifest("2.0.1"), b"test", "darwin-aarch64").is_err());
        assert!(verify(&key, manifest("2.0.0"), b"test", "darwin-x86_64").is_err());
    }
}
