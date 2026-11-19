use objc2::MainThreadMarker;
use objc2_app_kit::{NSModalResponseCancel, NSModalResponseOK, NSSavePanel};
use objc2_foundation::{NSData, NSString};

const MAX_THEME_BYTES: usize = 304_000;

/// 将文件写入用户通过系统保存面板确认的位置。
pub async fn save(app: tauri::AppHandle, name: String, content: Vec<u8>) -> Result<bool, String> {
    if !content.starts_with(b"PK\x03\x04")
        || content.len() > MAX_THEME_BYTES
        || name.chars().count() > 80
        || !name.ends_with(".icaltheme")
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
    {
        return Err("主题文件名或大小无效".into());
    }
    let (sender, mut receiver) = tauri::async_runtime::channel(1);
    app.run_on_main_thread(move || {
        let result = (|| {
            let marker = MainThreadMarker::new().ok_or("无法打开系统保存对话框")?;
            let panel = NSSavePanel::savePanel(marker);
            panel.setNameFieldStringValue(&NSString::from_str(&name));
            panel.setCanCreateDirectories(true);
            match panel.runModal() {
                response if response == NSModalResponseCancel => Ok(false),
                response if response == NSModalResponseOK => {
                    let url = panel.URL().ok_or("无法获取保存位置")?;
                    let data = NSData::with_bytes(&content);
                    if data.writeToURL_atomically(&url, true) {
                        Ok(true)
                    } else {
                        Err("无法写入主题文件")
                    }
                }
                _ => Err("无法打开系统保存对话框"),
            }
        })();
        let _ = sender.try_send(result);
    })
    .map_err(|_| "无法打开系统保存对话框")?;
    receiver
        .recv()
        .await
        .ok_or("主题保存已中断")?
        .map_err(str::to_owned)
}
