use chrono::{DateTime, Datelike, Local, Timelike};
use serde::Deserialize;
use serde_json::Value;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Condvar, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::Manager;

const TOKENS: [&str; 17] = [
    "YYYY", "dddd", "ddd", "YY", "MM", "DD", "HH", "hh", "mm", "ss", "M", "D", "H", "h", "m", "s",
    "A",
];

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
pub struct ClockPreferences {
    pub enabled: bool,
    #[serde(rename = "showIcon", default = "default_show_icon")]
    pub show_icon: bool,
    pub format: String,
}

fn default_show_icon() -> bool {
    true
}

impl Default for ClockPreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            show_icon: true,
            format: "HH:mm".into(),
        }
    }
}

#[derive(Debug)]
enum Segment {
    Token(String),
    Literal(String),
}

fn parse_format(format: &str) -> Result<Vec<Segment>, String> {
    if format.trim().is_empty()
        || format.encode_utf16().count() > 48
        || format
            .chars()
            .any(|c| c.is_control() || c == '\u{2028}' || c == '\u{2029}')
    {
        return Err("格式须为 1—48 个字符，且不能包含换行或控制字符".into());
    }
    let mut rest = format;
    let mut result = Vec::new();
    while !rest.is_empty() {
        if let Some(literal) = rest.strip_prefix('[') {
            let end = literal.find(']').ok_or("方括号未闭合")?;
            result.push(Segment::Literal(literal[..end].into()));
            rest = &literal[end + 1..];
        } else if let Some(token) = TOKENS.iter().find(|token| rest.starts_with(**token)) {
            result.push(Segment::Token((*token).into()));
            rest = &rest[token.len()..];
        } else {
            let c = rest.chars().next().ok_or("格式为空")?;
            if c.is_ascii_alphabetic() || c == ']' || c == '%' {
                return Err("存在不支持的格式符；普通英文请放在方括号中".into());
            }
            result.push(Segment::Literal(c.to_string()));
            rest = &rest[c.len_utf8()..];
        }
    }
    Ok(result)
}

impl ClockPreferences {
    fn validate(&self) -> Result<(), String> {
        let parts = parse_format(&self.format)?;
        let visible_text = parts.iter().any(|part| match part {
            Segment::Token(_) => true,
            Segment::Literal(text) => !text.trim().is_empty(),
        });
        if !self.show_icon && (!self.enabled || !visible_text) {
            return Err("请至少显示图标或有效的时间文字".into());
        }
        Ok(())
    }
    pub fn from_saved(state: Option<&Value>) -> Result<Self, String> {
        let Some(value) = state.and_then(|state| state.pointer("/preferences/menuClock")) else {
            return Ok(Self::default());
        };
        let settings: Self =
            serde_json::from_value(value.clone()).map_err(|_| "菜单栏时间设置无效")?;
        settings.validate()?;
        Ok(settings)
    }
}

fn format_time<T: chrono::TimeZone>(format: &str, now: &DateTime<T>) -> Result<String, String> {
    let weekday =
        ["日", "一", "二", "三", "四", "五", "六"][now.weekday().num_days_from_sunday() as usize];
    let hour12 = if now.hour() % 12 == 0 {
        12
    } else {
        now.hour() % 12
    };
    parse_format(format)?
        .into_iter()
        .map(|part| {
            Ok(match part {
                Segment::Literal(text) => text,
                Segment::Token(token) => match token.as_str() {
                    "YYYY" => format!("{:04}", now.year()),
                    "YY" => format!("{:02}", now.year() % 100),
                    "MM" => format!("{:02}", now.month()),
                    "M" => now.month().to_string(),
                    "DD" => format!("{:02}", now.day()),
                    "D" => now.day().to_string(),
                    "dddd" => format!("星期{weekday}"),
                    "ddd" => format!("周{weekday}"),
                    "HH" => format!("{:02}", now.hour()),
                    "H" => now.hour().to_string(),
                    "hh" => format!("{hour12:02}"),
                    "h" => hour12.to_string(),
                    "mm" => format!("{:02}", now.minute()),
                    "m" => now.minute().to_string(),
                    "ss" => format!("{:02}", now.second()),
                    "s" => now.second().to_string(),
                    "A" => {
                        if now.hour() < 12 {
                            "上午".into()
                        } else {
                            "下午".into()
                        }
                    }
                    _ => return Err("不支持的格式符".into()),
                },
            })
        })
        .collect()
}

fn next_delay(format: &str, now: &DateTime<Local>) -> Duration {
    let seconds = parse_format(format).is_ok_and(|parts| {
        parts
            .iter()
            .any(|part| matches!(part, Segment::Token(token) if token == "s" || token == "ss"))
    });
    let millis = now.timestamp_subsec_millis() as u64;
    Duration::from_millis(if seconds {
        1_000 - millis
    } else {
        60_000 - now.second() as u64 * 1_000 - millis
    })
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct RenderedAppearance {
    title: String,
    show_icon: bool,
}

#[derive(Default)]
pub struct MenuClock {
    settings: Mutex<ClockPreferences>,
    changed: Condvar,
    stopped: AtomicBool,
    rendered: Mutex<Option<RenderedAppearance>>,
}

impl MenuClock {
    pub fn update(&self, settings: ClockPreferences) -> Result<(), String> {
        settings.validate()?;
        *self.settings.lock().map_err(|_| "时钟设置正在更新")? = settings;
        self.changed.notify_all();
        Ok(())
    }
    pub fn wake(&self) {
        self.changed.notify_all();
    }
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Relaxed);
        self.wake();
    }
}

/// 原生工作线程独立于 WebView；仅更新发生变化的文字或图标。
pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")) else {
            eprintln!("菜单栏图标无法加载");
            return;
        };
        let runtime = app.state::<crate::RuntimeState>();
        let clock = &runtime.menu_clock;
        while !clock.stopped.load(Ordering::Relaxed) {
            let Ok(settings) = clock.settings.lock().map(|value| value.clone()) else {
                break;
            };
            let now = Local::now();
            let title = if settings.enabled {
                format_time(&settings.format, &now).unwrap_or_default()
            } else {
                String::new()
            };
            // 即使格式输出意外为空，也保留图标作为可点击入口。
            let desired = RenderedAppearance {
                show_icon: settings.show_icon || title.trim().is_empty(),
                title,
            };
            let current = clock.rendered.lock().ok().and_then(|value| value.clone());
            if current.as_ref() != Some(&desired) {
                if let Some(tray) = app.tray_by_id("calendar") {
                    let icon_changed = current
                        .as_ref()
                        .is_none_or(|value| value.show_icon != desired.show_icon);
                    let title_changed = current
                        .as_ref()
                        .is_none_or(|value| value.title != desired.title);
                    // 恢复图标在先、隐藏图标在后，任一步失败都不先移除最后一个入口。
                    // Tauri 内部切到主线程；调用期间不持有设置锁，避免 IPC 死锁。
                    let applied: tauri::Result<()> = (|| {
                        if desired.show_icon && icon_changed {
                            tray.set_icon_with_as_template(Some(icon.clone()), true)?;
                        }
                        if title_changed {
                            tray.set_title(if desired.title.is_empty() {
                                None
                            } else {
                                Some(desired.title.as_str())
                            })?;
                        }
                        if !desired.show_icon && icon_changed {
                            tray.set_icon_with_as_template(None, true)?;
                        }
                        Ok(())
                    })();
                    if applied.is_ok() {
                        if let Ok(mut rendered) = clock.rendered.lock() {
                            *rendered = Some(desired);
                        }
                    }
                }
            }
            let Ok(guard) = clock.settings.lock() else {
                break;
            };
            if *guard == settings && !clock.stopped.load(Ordering::Relaxed) {
                let delay = if settings.enabled {
                    next_delay(&settings.format, &now)
                } else {
                    Duration::from_secs(60)
                };
                let _wait = clock.changed.wait_timeout(guard, delay);
            }
        }
    });
}

async fn wait_rendered(
    app: tauri::AppHandle,
    previous: Option<String>,
    expect_icon: bool,
    expect_time: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            let rendered = app
                .state::<crate::RuntimeState>()
                .menu_clock
                .rendered
                .lock()
                .ok()
                .and_then(|value| value.clone());
            if let Some(rendered) = rendered {
                if rendered.show_icon == expect_icon
                    && ((!expect_time && rendered.title.is_empty())
                        || (expect_time
                            && rendered.title.len() == 8
                            && Some(&rendered.title) != previous.as_ref()))
                {
                    return Ok(rendered.title);
                }
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err("菜单栏时钟刷新验证超时".into())
    })
    .await
    .map_err(|_| "时钟验证线程失败")?
}

/// 通过主线程读取真实 NSStatusBarButton，校验图片、模板、文字和可点击尺寸。
async fn verify_status(
    app: tauri::AppHandle,
    show_icon: bool,
    show_time: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tray = app.tray_by_id("calendar").ok_or("菜单栏入口不存在")?;
        tray.with_inner_tray_icon(move |inner| -> Result<(), String> {
            let main = objc2::MainThreadMarker::new().ok_or("菜单栏检查不在主线程")?;
            let button = inner
                .ns_status_item()
                .and_then(|item| item.button(main))
                .ok_or("菜单栏按钮不存在")?;
            let image = button.image();
            let title = button.title().to_string();
            if image.is_some() != show_icon
                || (show_icon && !image.is_some_and(|image| image.isTemplate()))
                || show_time != !title.trim().is_empty()
                || button.frame().size.width <= 0.0
            {
                return Err("原生菜单栏图标、模板或文字状态不符合预期".into());
            }
            Ok(())
        })
        .map_err(|_| "无法读取原生菜单栏状态")?
    })
    .await
    .map_err(|_| "菜单栏验证线程失败")?
}

/// 冒烟实例只改内存：校验图文、纯时间、纯图标，以及恢复后的原生状态。
pub async fn verify_smoke(app: &tauri::AppHandle) -> Result<(), String> {
    let first = wait_rendered(app.clone(), None, true, true).await?;
    wait_rendered(app.clone(), Some(first), true, true).await?;
    verify_status(app.clone(), true, true).await?;
    app.state::<crate::RuntimeState>()
        .menu_clock
        .update(ClockPreferences {
            enabled: true,
            show_icon: false,
            format: "HH:mm:ss".into(),
        })?;
    let first = wait_rendered(app.clone(), None, false, true).await?;
    wait_rendered(app.clone(), Some(first), false, true).await?;
    verify_status(app.clone(), false, true).await?;
    app.state::<crate::RuntimeState>()
        .menu_clock
        .update(ClockPreferences {
            enabled: false,
            show_icon: true,
            format: "HH:mm:ss".into(),
        })?;
    wait_rendered(app.clone(), None, true, false).await?;
    verify_status(app.clone(), true, false).await?;
    // 恢复时使用秒格式，以便共用冒烟等待条件；只影响此隔离实例。
    app.state::<crate::RuntimeState>()
        .menu_clock
        .update(ClockPreferences {
            format: "HH:mm:ss".into(),
            ..ClockPreferences::default()
        })?;
    wait_rendered(app.clone(), None, true, true).await?;
    verify_status(app.clone(), true, true).await?;
    println!("PASS：菜单栏图文、纯时间、纯图标与模板恢复通过，收起后时间继续刷新");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_format_fixtures_match_frontend() {
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../../packages/calendar-ui/test/fixtures/menu-clock.json"
        ))
        .unwrap();
        for item in fixture["cases"].as_array().unwrap() {
            let now = DateTime::parse_from_rfc3339(item["date"].as_str().unwrap()).unwrap();
            assert_eq!(
                format_time(item["format"].as_str().unwrap(), &now).unwrap(),
                item["expected"].as_str().unwrap()
            );
        }
        for format in fixture["invalid"].as_array().unwrap() {
            assert!(parse_format(format.as_str().unwrap()).is_err());
        }
    }
    #[test]
    fn legacy_and_invalid_preferences_are_distinct() {
        assert_eq!(
            ClockPreferences::from_saved(None).unwrap(),
            ClockPreferences::default()
        );
        assert!(ClockPreferences::from_saved(Some(
            &serde_json::json!({"preferences":{"menuClock":{"enabled":true,"format":"bad"}}})
        ))
        .is_err());
    }
    #[test]
    fn refresh_cadence_ignores_literal_seconds() {
        let now = DateTime::parse_from_rfc3339("2026-11-12T08:05:09.250+08:00")
            .unwrap()
            .with_timezone(&Local);
        assert_eq!(next_delay("HH:mm:ss", &now), Duration::from_millis(750));
        assert_eq!(
            next_delay("HH:mm [ss]", &now),
            Duration::from_millis(50_750)
        );
    }
    #[test]
    fn icon_visibility_matches_shared_preferences_and_never_removes_all_entries() {
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../../packages/calendar-ui/test/fixtures/menu-clock.json"
        ))
        .unwrap();
        for item in fixture["visibility"].as_array().unwrap() {
            let state = serde_json::json!({"preferences":{"menuClock":item["input"]}});
            let result = ClockPreferences::from_saved(Some(&state));
            if let Some(expected) = item.get("expected") {
                let value = result.unwrap();
                assert_eq!(value.enabled, expected["enabled"].as_bool().unwrap());
                assert_eq!(value.show_icon, expected["showIcon"].as_bool().unwrap());
                assert_eq!(value.format, expected["format"].as_str().unwrap());
            } else {
                assert!(result.is_err());
            }
        }
    }
}
