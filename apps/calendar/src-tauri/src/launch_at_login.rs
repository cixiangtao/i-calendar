use std::path::Path;
use tauri_plugin_autostart::ManagerExt;

pub const ARGUMENT: &str = "--autostart";

pub fn background_start<'a>(arguments: impl IntoIterator<Item = &'a str>) -> bool {
    arguments.into_iter().any(|argument| argument == ARGUMENT)
}

fn bundled_executable(path: &Path) -> bool {
    path.parent()
        .filter(|parent| parent.file_name().is_some_and(|name| name == "MacOS"))
        .and_then(Path::parent)
        .filter(|parent| parent.file_name().is_some_and(|name| name == "Contents"))
        .and_then(Path::parent)
        .is_some_and(|bundle| {
            bundle
                .extension()
                .is_some_and(|extension| extension == "app")
        })
}

pub fn available() -> bool {
    !cfg!(debug_assertions)
        && !std::env::args().any(|argument| argument == "--smoke-test")
        && std::env::current_exe().is_ok_and(|path| bundled_executable(&path))
}

fn require_available() -> Result<(), String> {
    if available() {
        Ok(())
    } else {
        Err("请在打包后的 Mac 应用中设置开机自启".into())
    }
}

pub fn get(app: &tauri::AppHandle) -> Result<bool, String> {
    require_available()?;
    app.autolaunch()
        .is_enabled()
        .map_err(|_| "无法读取开机自启状态".into())
}

pub fn set(app: &tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    require_available()?;
    // 上游 LaunchAgent 使用 XML 文本记录路径，拒绝不能安全表示的路径。
    if enabled {
        let executable = std::env::current_exe()
            .and_then(std::fs::canonicalize)
            .map_err(|_| "无法确定应用位置")?;
        if executable
            .to_str()
            .is_none_or(|path| path.contains(['&', '<']))
        {
            return Err("请将应用移至“应用程序”文件夹后再开启开机自启".into());
        }
    }
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|_| "无法修改开机自启设置")?;
    manager
        .is_enabled()
        .map_err(|_| "无法确认开机自启状态".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_argument_is_explicit_and_bundled_path_is_required() {
        assert!(background_start(["i-calendar", ARGUMENT]));
        assert!(!background_start(["i-calendar", "--autostart=false"]));
        assert!(!background_start(["i-calendar"]));
        assert!(bundled_executable(Path::new(
            "/Applications/i日历.app/Contents/MacOS/i-calendar"
        )));
        assert!(!bundled_executable(Path::new(
            "/tmp/target/debug/i-calendar"
        )));
        assert!(!bundled_executable(Path::new("/tmp/i日历.app/i-calendar")));
        assert!(!available(), "开发与隔离测试不能注册系统启动项");
    }
}
