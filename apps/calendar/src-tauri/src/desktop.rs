use crate::RuntimeState;
use objc2_app_kit::{
    NSAnimatablePropertyContainer, NSAnimationContext, NSColor, NSWindow, NSWorkspace,
};
use objc2_quartz_core::CAMediaTimingFunction;
use std::{sync::atomic::Ordering, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

const POPUP_CORNER_RADIUS: f64 = 20.0;
const POPUP_ENTER_SECONDS: f64 = 0.28;

struct PopupLayout {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    enter_distance: f64,
}

/// Tauri 的 set_position 在 macOS 内部再次异步派发；这里在主线程直接设置
/// AppKit frame，避免它与随后开始的动画争用终点。坐标通过当前窗口换算，
/// 保留 Tauri 的多屏坐标口径，同时处理 AppKit 纵轴方向及高度变化。
fn position_popup(
    window: &tauri::WebviewWindow,
    native: &NSWindow,
    layout: &PopupLayout,
) -> tauri::Result<()> {
    let current = window
        .outer_position()?
        .to_logical::<f64>(window.scale_factor()?);
    let mut frame = native.frame();
    frame.origin.x += layout.x - current.x;
    frame.origin.y += current.y - layout.y + frame.size.height - layout.height;
    frame.size.width = layout.width;
    frame.size.height = layout.height;
    native.setFrame_display(frame, true);
    Ok(())
}

/// 仅在主线程调用；零时长覆盖旧动画，避免快速收起重开时沿用旧终点。
fn stop_popup_motion(native: &NSWindow) {
    NSAnimationContext::beginGrouping();
    NSAnimationContext::currentContext().setDuration(0.0);
    native.animator().setFrame_display(native.frame(), false);
    native.animator().setAlphaValue(1.0);
    NSAnimationContext::endGrouping();
}

pub fn hide_calendar(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let handle = window.clone();
    window.with_webview(move |webview| {
        // SAFETY: with_webview 在主线程执行，句柄在回调期间有效。
        if let Some(native) = unsafe { webview.ns_window().cast::<NSWindow>().as_ref() } {
            stop_popup_motion(native);
        }
        if let Err(error) = handle.hide() {
            eprintln!("无法收起日历：{error}");
        }
    })
}

/// 仅在 setup 主线程调用；在原生内容视图裁切整棵 WebView，窗口四角真正透明。
fn round_popup(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let pointer = window.ns_window()?.cast::<NSWindow>();
    // SAFETY: Tauri 的 setup 位于主线程，窗口仍由 WebviewWindow 持有。
    let native = unsafe { pointer.as_ref() }.ok_or(tauri::Error::InvalidWindowHandle)?;
    let content = native
        .contentView()
        .ok_or_else(|| std::io::Error::other("无法获取悬浮窗内容视图"))?;
    content.setWantsLayer(true);
    let layer = content
        .layer()
        .ok_or_else(|| std::io::Error::other("无法创建悬浮窗圆角图层"))?;
    layer.setCornerRadius(POPUP_CORNER_RADIUS);
    layer.setMasksToBounds(true);
    native.setOpaque(false);
    native.setBackgroundColor(Some(&NSColor::clearColor()));
    native.invalidateShadow();
    Ok(())
}

/// 从真实 AppKit 窗口读取裁切状态；通过主线程回调保证原生视图访问安全。
pub async fn verify_rounded_popup(window: &tauri::WebviewWindow) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window
        .with_webview(move |webview| {
            let result = (|| {
                // SAFETY: with_webview 在主线程执行，原生窗口在回调期间有效。
                let native = unsafe { webview.ns_window().cast::<NSWindow>().as_ref() }
                    .ok_or("悬浮窗原生句柄不存在")?;
                let layer = native
                    .contentView()
                    .and_then(|view| view.layer())
                    .ok_or("悬浮窗圆角图层不存在")?;
                let clear_background = native.backgroundColor().alphaComponent() == 0.0;
                if (layer.cornerRadius() - POPUP_CORNER_RADIUS).abs() > f64::EPSILON
                    || !layer.masksToBounds()
                    || native.isOpaque()
                    || !clear_background
                    || !native.hasShadow()
                {
                    return Err("悬浮窗圆角、透明边角或系统阴影未生效");
                }
                Ok(())
            })();
            let _ = sender.send(result.map_err(str::to_owned));
        })
        .map_err(|_| "无法检查原生悬浮窗")?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "原生悬浮窗检查超时".to_string())?
    })
    .await
    .map_err(|_| "原生悬浮窗检查线程失败")?
}

/// 保留内容期望高度；每次打开时重新按菜单栏所在屏幕布局。
pub fn resize_popup(app: &tauri::AppHandle, height: f64) -> Result<(), String> {
    if !height.is_finite() || !(160.0..=4096.0).contains(&height) {
        return Err("悬浮窗内容高度无效".into());
    }
    let previous = app
        .state::<RuntimeState>()
        .popup_height
        .swap(height.ceil() as u32, Ordering::Relaxed);
    if previous == height.ceil() as u32 {
        return Ok(());
    }
    let layout = layout_popup(app).map_err(|error| error.to_string())?;
    if let (Some(layout), Some(window)) = (layout, app.get_webview_window("main")) {
        let handle = window.clone();
        window
            .with_webview(move |webview| {
                // SAFETY: 主线程回调内原生窗口始终有效。
                if let Some(native) = unsafe { webview.ns_window().cast::<NSWindow>().as_ref() } {
                    stop_popup_motion(native);
                    if let Err(error) = position_popup(&handle, native, &layout) {
                        eprintln!("无法调整悬浮窗：{error}");
                    }
                }
            })
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn fitted_height(requested: f64, work_height: f64, scale: f64) -> f64 {
    requested.min((work_height / scale - 16.0).max(1.0))
}

pub fn verify_content_height(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("主界面不存在")?;
    let monitor = window
        .current_monitor()
        .map_err(|_| "无法读取悬浮窗屏幕")?
        .ok_or("悬浮窗屏幕不存在")?;
    let desired = app
        .state::<RuntimeState>()
        .popup_height
        .load(Ordering::Relaxed);
    let expected = fitted_height(
        desired as f64,
        monitor.work_area().size.height as f64,
        monitor.scale_factor(),
    );
    let actual = window
        .inner_size()
        .map_err(|_| "无法读取悬浮窗高度")?
        .to_logical::<f64>(window.scale_factor().map_err(|_| "无法读取屏幕缩放")?);
    if desired == 0 || (actual.height - expected).abs() > 1.0 {
        return Err(format!(
            "悬浮窗内容高度未生效：期望 {expected}，实际 {}",
            actual.height
        ));
    }
    Ok(())
}

async fn motion_snapshot(window: &tauri::WebviewWindow) -> Result<(f64, f64, bool), String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window
        .with_webview(move |webview| {
            // SAFETY: 与生产动画一样，所有 AppKit 状态均在主线程读取。
            let result = unsafe { webview.ns_window().cast::<NSWindow>().as_ref() }
                .map(|native| {
                    (
                        native.frame().origin.x,
                        native.alphaValue(),
                        NSWorkspace::sharedWorkspace().accessibilityDisplayShouldReduceMotion(),
                    )
                })
                .ok_or_else(|| "无法读取原生动画状态".to_string());
            let _ = sender.send(result);
        })
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "读取原生动画状态超时".to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 只在隔离冒烟中执行，检查真实窗口轨迹、最终停靠和快速打断，不改系统偏好。
pub async fn verify_popup_motion(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("主界面不存在")?;
    wait_for_motion_settle().await;
    let settled = motion_snapshot(&window).await?;
    hide_calendar(&window).map_err(|error| error.to_string())?;
    show_calendar(app);
    let start = motion_snapshot(&window).await?;
    tauri::async_runtime::spawn_blocking(|| std::thread::sleep(Duration::from_millis(65)))
        .await
        .map_err(|error| error.to_string())?;
    let middle = motion_snapshot(&window).await?;
    wait_for_motion_settle().await;
    let end = motion_snapshot(&window).await?;
    if (end.0 - settled.0).abs() > 1.0 || (end.1 - 1.0).abs() > 0.01 {
        return Err("悬浮窗入场终点或透明度未恢复".into());
    }
    if !start.2 && !(start.0 > middle.0 + 1.0 && middle.0 > end.0 + 1.0) {
        return Err(format!(
            "悬浮窗未从右侧平滑进入：{start:?} → {middle:?} → {end:?}"
        ));
    }
    // 连续收起、打开，并在入场尚未结束时再次打断。
    hide_calendar(&window).map_err(|error| error.to_string())?;
    show_calendar(app);
    hide_calendar(&window).map_err(|error| error.to_string())?;
    show_calendar(app);
    wait_for_motion_settle().await;
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .ok_or("悬浮窗屏幕不存在")?;
    let area = monitor.work_area();
    let width = window
        .inner_size()
        .map_err(|error| error.to_string())?
        .width as f64;
    let expected = popup_position(
        width,
        area.position.x as f64,
        area.position.y as f64,
        area.size.width as f64,
        monitor.scale_factor(),
    );
    let actual = window.outer_position().map_err(|error| error.to_string())?;
    if !window.is_visible().unwrap_or(false)
        || (actual.x - expected.0).abs() > 1
        || (actual.y - expected.1).abs() > 1
    {
        return Err(format!(
            "快速重开后未停靠右上方：{actual:?}，期望 {expected:?}"
        ));
    }
    let content_height = app
        .state::<RuntimeState>()
        .popup_height
        .load(Ordering::Relaxed);
    for height in [660.0, content_height as f64] {
        resize_popup(app, height)?;
        verify_content_height(app)?;
        let resized = window.outer_position().map_err(|error| error.to_string())?;
        if (resized.x - expected.0).abs() > 1 || (resized.y - expected.1).abs() > 1 {
            return Err("切换设置高度后悬浮窗未保持右上方停靠".into());
        }
    }
    println!("PASS：原生右侧入场轨迹 {start:?} → {middle:?} → {end:?}；快速收起重开后停靠右上方");
    println!("PASS：设置高度与日历内容高度切换后保持右上方停靠");
    Ok(())
}

pub async fn wait_for_motion_settle() {
    let _ = tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(Duration::from_millis(360));
    })
    .await;
}

fn layout_popup(app: &tauri::AppHandle) -> tauri::Result<Option<PopupLayout>> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(None);
    };
    let tray_rect = app
        .tray_by_id("calendar")
        .and_then(|tray| tray.rect().ok().flatten());
    let scale = window.scale_factor()?;
    let anchor = tray_rect.map(|rect| {
        let point = rect.position.to_physical::<f64>(scale);
        let icon = rect.size.to_physical::<f64>(scale);
        (point.x, point.y, icon.width, icon.height)
    });
    let monitor = if let Some((x, y, _, _)) = anchor {
        window.available_monitors()?.into_iter().find(|monitor| {
            let origin = monitor.position();
            let size = monitor.size();
            x >= origin.x as f64
                && x < origin.x as f64 + size.width as f64
                && y >= origin.y as f64
                && y < origin.y as f64 + size.height as f64
        })
    } else {
        None
    }
    .or(window.current_monitor()?);
    let Some(monitor) = monitor else {
        return Ok(None);
    };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let desired = app
        .state::<RuntimeState>()
        .popup_height
        .load(Ordering::Relaxed);
    let size = window
        .inner_size()?
        .to_logical::<f64>(window.scale_factor()?);
    let height = fitted_height(
        if desired == 0 {
            size.height
        } else {
            desired as f64
        },
        area.size.height as f64,
        scale,
    );
    let (x, y) = popup_position(
        size.width * scale,
        area.position.x as f64,
        area.position.y as f64,
        area.size.width as f64,
        scale,
    );
    // 从整个屏幕的右边缘进入；即使 Dock 位于右侧，起点仍在屏幕外。
    Ok(Some(PopupLayout {
        x: x as f64 / scale,
        y: y as f64 / scale,
        width: size.width,
        height,
        enter_distance: (monitor.position().x as f64 + monitor.size().width as f64 - x as f64)
            / scale
            + 16.0,
    }))
}

pub fn show_calendar(app: &tauri::AppHandle) {
    app.state::<RuntimeState>().menu_clock.wake();
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.set_focus();
            return;
        }
        let layout = match layout_popup(app) {
            Ok(layout) => layout,
            Err(error) => {
                eprintln!("悬浮窗布局失败：{error}");
                None
            }
        };
        let handle = window.clone();
        if let Err(error) = window.with_webview(move |webview| {
            // SAFETY: AppKit 的窗口、动画上下文和辅助功能设置只在主线程访问。
            let Some(native) = (unsafe { webview.ns_window().cast::<NSWindow>().as_ref() }) else {
                let _ = handle.show();
                let _ = handle.set_focus();
                return;
            };
            if native.isVisible() {
                let _ = handle.set_focus();
                return;
            }
            stop_popup_motion(native);
            let mut distance = 0.0;
            if let Some(layout) = layout {
                if let Err(error) = position_popup(&handle, native, &layout) {
                    eprintln!("无法定位悬浮窗：{error}");
                } else {
                    distance = layout.enter_distance;
                }
            }
            let target = native.frame();
            let reduced = NSWorkspace::sharedWorkspace().accessibilityDisplayShouldReduceMotion();
            if reduced {
                native.setAlphaValue(0.0);
            } else {
                let mut start = target;
                start.origin.x += distance;
                native.setFrame_display(start, false);
            }
            let _ = handle.show();
            let _ = handle.set_focus();
            NSAnimationContext::beginGrouping();
            let context = NSAnimationContext::currentContext();
            context.setDuration(if reduced { 0.12 } else { POPUP_ENTER_SECONDS });
            context.setTimingFunction(Some(&CAMediaTimingFunction::functionWithControlPoints(
                0.16, 1.0, 0.3, 1.0,
            )));
            if reduced {
                native.animator().setAlphaValue(1.0);
            } else {
                native.animator().setFrame_display(target, true);
            }
            NSAnimationContext::endGrouping();
        }) {
            eprintln!("无法显示悬浮窗动画：{error}");
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn popup_position(width: f64, left: f64, top: f64, screen_width: f64, scale: f64) -> (i32, i32) {
    let margin = 8.0 * scale;
    let max_x = (left + screen_width - width - margin).max(left + margin);
    (max_x.round() as i32, (top + margin).round() as i32)
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    let clock = crate::read_saved_state(app.handle())
        .and_then(|value| crate::menu_clock::ClockPreferences::from_saved(value.as_ref()));
    match clock {
        Ok(settings) => {
            let _ = app.state::<RuntimeState>().menu_clock.update(settings);
        }
        Err(error) => eprintln!("菜单栏时钟采用默认设置：{error}"),
    }
    let open = MenuItem::with_id(app, "open", "打开i日历", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置与调休数据…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出i日历", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &settings, &quit])?;
    let _tray = TrayIconBuilder::with_id("calendar")
        .icon(tauri::image::Image::from_bytes(include_bytes!(
            "../icons/tray.png"
        ))?)
        .icon_as_template(true)
        .tooltip("i日历 · 公农历与放假调休")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_calendar(app),
            "settings" => {
                show_calendar(app);
                let _ = app.emit("calendar:settings", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = hide_calendar(&window);
                    } else {
                        show_calendar(app);
                    }
                }
            }
        })
        .build(app)?;
    crate::menu_clock::start(app.handle().clone());
    if let Some(window) = app.get_webview_window("main") {
        round_popup(&window)?;
        let _ = window.set_visible_on_all_workspaces(true);
        let handle = app.handle().clone();
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = hide_calendar(&window);
                }
            }
            WindowEvent::Focused(false) => {
                let app = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(180));
                    let busy = app
                        .state::<RuntimeState>()
                        .popup_busy
                        .load(Ordering::Relaxed);
                    if let Some(window) = app.get_webview_window("main") {
                        if !busy && !window.is_focused().unwrap_or(false) {
                            let _ = hide_calendar(&window);
                        }
                    }
                });
            }
            _ => {}
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{fitted_height, popup_position};
    #[test]
    fn content_height_fits_monitor_work_area_at_each_scale() {
        assert_eq!(fitted_height(740.0, 1000.0, 1.0), 740.0);
        assert_eq!(fitted_height(740.0, 1000.0, 2.0), 484.0);
        assert_eq!(fitted_height(660.0, 2000.0, 2.0), 660.0);
        assert_eq!(fitted_height(900.0, 800.0, 1.0), 784.0);
    }

    #[test]
    fn popup_docks_top_right_on_primary_negative_and_retina_work_areas() {
        assert_eq!(popup_position(400.0, 0.0, 24.0, 1440.0, 1.0), (1032, 32));
        assert_eq!(
            popup_position(400.0, -1440.0, 24.0, 1440.0, 1.0),
            (-408, 32)
        );
        assert_eq!(popup_position(800.0, 0.0, 48.0, 2880.0, 2.0), (2064, 64));
        // 右侧 Dock 缩小工作区、显示器纵向偏移和极窄屏幕。
        assert_eq!(
            popup_position(800.0, 2880.0, -1700.0, 1800.0, 2.0),
            (3864, -1684)
        );
        assert_eq!(popup_position(400.0, 0.0, 24.0, 300.0, 1.0), (8, 32));
    }
}
