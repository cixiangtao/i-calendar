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
    pub format: String,
}

impl Default for ClockPreferences {
    fn default() -> Self {
        Self {
            enabled: true,
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
    pub fn from_saved(state: Option<&Value>) -> Result<Self, String> {
        let Some(value) = state.and_then(|state| state.pointer("/preferences/menuClock")) else {
            return Ok(Self::default());
        };
        let settings: Self =
            serde_json::from_value(value.clone()).map_err(|_| "菜单栏时间设置无效")?;
        parse_format(&settings.format)?;
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

#[derive(Default)]
pub struct MenuClock {
    settings: Mutex<ClockPreferences>,
    changed: Condvar,
    stopped: AtomicBool,
    rendered: Mutex<Option<String>>,
}

impl MenuClock {
    pub fn update(&self, settings: ClockPreferences) -> Result<(), String> {
        parse_format(&settings.format)?;
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

/// 原生工作线程独立于 WebView；只有文字改变时才更新菜单栏。
pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || {
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
            let current = clock.rendered.lock().ok().and_then(|value| value.clone());
            if current.as_ref() != Some(&title) {
                if let Some(tray) = app.tray_by_id("calendar") {
                    // Tauri 在内部切到主线程；调用期间不持有设置锁，避免 IPC 更新死锁。
                    if tray
                        .set_title(if title.is_empty() {
                            None
                        } else {
                            Some(title.as_str())
                        })
                        .is_ok()
                    {
                        if let Ok(mut rendered) = clock.rendered.lock() {
                            *rendered = Some(title);
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
    hidden: bool,
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
            if let Some(title) = rendered {
                if (hidden && title.is_empty())
                    || (!hidden && title.len() == 8 && Some(&title) != previous.as_ref())
                {
                    return Ok(title);
                }
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err("菜单栏时钟刷新验证超时".into())
    })
    .await
    .map_err(|_| "时钟验证线程失败")?
}

/// 冒烟实例只改内存：弹窗收起后秒钟继续走，关闭显示后清空标题。
pub async fn verify_smoke(app: &tauri::AppHandle) -> Result<(), String> {
    let first = wait_rendered(app.clone(), None, false).await?;
    wait_rendered(app.clone(), Some(first), false).await?;
    app.state::<crate::RuntimeState>()
        .menu_clock
        .update(ClockPreferences {
            enabled: false,
            format: "HH:mm:ss".into(),
        })?;
    wait_rendered(app.clone(), None, true).await?;
    println!("PASS：菜单栏时钟在弹窗收起后持续刷新，关闭显示可清空标题");
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
}
