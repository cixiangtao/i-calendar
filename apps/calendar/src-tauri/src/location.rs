//! 一次性系统定位。对象只在主线程持有；坐标不写磁盘、不写日志，不启动持续追踪。
// CLGeocoder 为最低系统兼容保留；较新 SDK 已建议 MapKit，但旧系统仍需此 API。
#![allow(deprecated)]

use block2::RcBlock;
use objc2::{
    define_class, msg_send, rc::Retained, runtime::ProtocolObject, AnyThread, DefinedClass,
    MainThreadOnly,
};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSApplication, NSWorkspace};
use objc2_core_location::{
    kCLLocationAccuracyBest, CLAuthorizationStatus, CLGeocoder, CLLocation, CLLocationManager,
    CLLocationManagerDelegate, CLPlacemark,
};
#[cfg(target_os = "macos")]
use objc2_foundation::NSURL;
use objc2_foundation::{
    ns_string, MainThreadMarker, NSArray, NSError, NSLocale, NSObject, NSObjectProtocol,
};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct LocationFailure {
    code: &'static str,
    message: String,
}
impl LocationFailure {
    fn permission(code: &'static str, message: &str) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
impl From<&str> for LocationFailure {
    fn from(message: &str) -> Self {
        Self::permission("unavailable", message)
    }
}

#[derive(Debug, PartialEq)]
enum AuthorizationAction {
    Request,
    Locate,
    PermissionRequired,
    Denied,
    Restricted,
    Wait,
}

// 只有明确点击才可以弹出授权；自动刷新绝不申请新权限。
fn authorization_action(
    status: CLAuthorizationStatus,
    allow_request: bool,
    requested: bool,
    started: bool,
) -> AuthorizationAction {
    if status == CLAuthorizationStatus::Denied {
        AuthorizationAction::Denied
    } else if status == CLAuthorizationStatus::Restricted {
        AuthorizationAction::Restricted
    } else if status == CLAuthorizationStatus::NotDetermined {
        if !allow_request {
            AuthorizationAction::PermissionRequired
        } else if requested {
            AuthorizationAction::Wait
        } else {
            AuthorizationAction::Request
        }
    } else if status == CLAuthorizationStatus::AuthorizedAlways
        || status == CLAuthorizationStatus::AuthorizedWhenInUse
    {
        if started {
            AuthorizationAction::Wait
        } else {
            AuthorizationAction::Locate
        }
    } else {
        AuthorizationAction::Wait
    }
}
use std::{
    cell::{Cell, RefCell},
    collections::{BTreeMap, VecDeque},
    sync::mpsc,
    time::Duration,
};

#[derive(Clone, Serialize)]
pub struct LocationFix {
    latitude: f64,
    longitude: f64,
    accuracy: f64,
    timestamp: f64,
}

struct DelegateState {
    sender: RefCell<Option<mpsc::Sender<Result<LocationFix, LocationFailure>>>>,
    started: Cell<bool>,
    allow_request: bool,
    permission_requested: Cell<bool>,
}

define_class!(
    // NSObject 无额外子类要求；Core Location 在创建管理器的主线程调用委托。
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    #[ivars = DelegateState]
    struct LocationDelegate;

    unsafe impl NSObjectProtocol for LocationDelegate {}

    unsafe impl CLLocationManagerDelegate for LocationDelegate {
        #[unsafe(method(locationManager:didUpdateLocations:))]
        fn updated(&self, manager: &CLLocationManager, locations: &NSArray<CLLocation>) {
            if let Some(location) = locations.lastObject() {
                let fix = unsafe {
                    let coordinate = location.coordinate();
                    LocationFix {
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude,
                        accuracy: location.horizontalAccuracy(),
                        timestamp: location.timestamp().timeIntervalSince1970() * 1000.0,
                    }
                };
                self.finish(
                    manager,
                    if valid_fix(&fix) {
                        Ok(fix)
                    } else {
                        Err("系统未返回有效定位，请重试或手动选择城市".into())
                    },
                );
            }
        }

        #[unsafe(method(locationManager:didFailWithError:))]
        fn failed(&self, manager: &CLLocationManager, error: &NSError) {
            let status = unsafe { manager.authorizationStatus() };
            if error.code() == 1
                && status == CLAuthorizationStatus::NotDetermined
                && self.ivars().permission_requested.get()
            {
                // 系统尚未确认授权时继续等待用户选择，不提前按拒绝处理。
                return;
            }
            let failure = if error.code() == 1 {
                LocationFailure::permission(
                    "permission-denied",
                    "系统尚未允许定位。请在定位设置中允许 i日历，或手动选择城市",
                )
            } else {
                LocationFailure::from("暂时无法获取位置，请检查网络与定位服务，或手动选择城市")
            };
            self.finish(manager, Err(failure));
        }

        #[unsafe(method(locationManagerDidChangeAuthorization:))]
        fn authorization(&self, manager: &CLLocationManager) {
            self.start_if_authorized(manager);
        }
    }
);

impl LocationDelegate {
    fn finish(&self, manager: &CLLocationManager, result: Result<LocationFix, LocationFailure>) {
        unsafe {
            manager.stopUpdatingLocation();
        }
        if let Some(sender) = self.ivars().sender.borrow_mut().take() {
            let _ = sender.send(result);
        }
    }

    fn start_if_authorized(&self, manager: &CLLocationManager) {
        if self.ivars().sender.borrow().is_none() {
            return;
        }
        let state = self.ivars();
        let action = authorization_action(
            unsafe { manager.authorizationStatus() },
            state.allow_request,
            state.permission_requested.get(),
            state.started.get(),
        );
        match action {
            AuthorizationAction::PermissionRequired => self.finish(
                manager,
                Err(LocationFailure::permission(
                    "permission-required",
                    "请点击“申请定位权限”，允许 i日历使用当前位置",
                )),
            ),
            AuthorizationAction::Denied => self.finish(
                manager,
                Err(LocationFailure::permission(
                    "permission-denied",
                    "i日历的定位权限未开启。可打开定位设置后重新检查，或手动选择城市",
                )),
            ),
            AuthorizationAction::Restricted => self.finish(
                manager,
                Err(LocationFailure::permission(
                    "restricted",
                    "设备限制了定位权限，请检查设备限制或手动选择城市",
                )),
            ),
            AuthorizationAction::Request => unsafe {
                state.permission_requested.set(true);
                manager.requestWhenInUseAuthorization();
            },
            AuthorizationAction::Locate => unsafe {
                state.started.set(true);
                manager.requestLocation();
            },
            AuthorizationAction::Wait => {}
        }
    }
}

struct PendingLocation {
    id: u64,
    manager: Retained<CLLocationManager>,
    _delegate: Retained<LocationDelegate>,
}

thread_local! {
    static PENDING: RefCell<Option<PendingLocation>> = const { RefCell::new(None) };
    static GEOCODERS: RefCell<BTreeMap<u64, Retained<CLGeocoder>>> = const { RefCell::new(BTreeMap::new()) };
    static CANCELLED: RefCell<VecDeque<u64>> = const { RefCell::new(VecDeque::new()) };
}

fn mark_cancelled(id: u64) {
    CANCELLED.with(|requests| {
        let mut requests = requests.borrow_mut();
        if !requests.contains(&id) {
            if requests.len() >= 64 {
                requests.pop_front();
            }
            requests.push_back(id);
        }
    });
}

fn was_cancelled(id: u64) -> bool {
    CANCELLED.with(|requests| requests.borrow().contains(&id))
}

fn valid_fix(fix: &LocationFix) -> bool {
    fix.latitude.is_finite()
        && fix.latitude.abs() <= 90.0
        && fix.longitude.is_finite()
        && fix.longitude.abs() <= 180.0
        && fix.accuracy.is_finite()
        && fix.accuracy >= 0.0
        && fix.timestamp.is_finite()
}

fn begin(id: u64, allow_request: bool, sender: mpsc::Sender<Result<LocationFix, LocationFailure>>) {
    // IPC 的取消可能先到达主线程；保留有界取消记录，避免随后才弹出权限框。
    if was_cancelled(id) {
        let _ = sender.send(Err("定位已取消".into()));
        return;
    }
    PENDING.with(|pending| {
        if pending.borrow().is_some() {
            let _ = sender.send(Err("正在获取位置，请稍后重试".into()));
            return;
        }
        let Some(mtm) = MainThreadMarker::new() else {
            let _ = sender.send(Err("定位服务未在主线程初始化".into()));
            return;
        };
        let delegate = unsafe {
            let allocated = LocationDelegate::alloc(mtm).set_ivars(DelegateState {
                sender: RefCell::new(Some(sender)),
                started: Cell::new(false),
                allow_request,
                permission_requested: Cell::new(false),
            });
            let delegate: Retained<LocationDelegate> = msg_send![super(allocated), init];
            delegate
        };
        let manager = unsafe { CLLocationManager::new() };
        unsafe {
            manager.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
            manager.setDesiredAccuracy(kCLLocationAccuracyBest);
        }
        // 委托必须强持有；manager 的 delegate 属性本身是弱引用。
        *pending.borrow_mut() = Some(PendingLocation {
            id,
            manager: manager.clone(),
            _delegate: delegate.clone(),
        });
        // 初始授权状态由系统回调驱动；不在管理器刚创建时用缓存状态提前拒绝。
    });
}

/// 只在用户点击后激活菜单栏应用，并等待实际进入前台再请求权限。
#[cfg(target_os = "macos")]
async fn ensure_foreground(app: tauri::AppHandle, id: u64) -> Result<(), LocationFailure> {
    tauri::async_runtime::spawn_blocking(move || {
        for attempt in 0..20 {
            let (sender, receiver) = mpsc::channel();
            app.run_on_main_thread(move || {
                if was_cancelled(id) {
                    let _ = sender.send(Err(LocationFailure::from("定位已取消")));
                    return;
                }
                let Some(mtm) = MainThreadMarker::new() else {
                    let _ = sender.send(Err(LocationFailure::from("定位服务未在主线程初始化")));
                    return;
                };
                let application = NSApplication::sharedApplication(mtm);
                if attempt == 0 && !application.isActive() {
                    application.activateIgnoringOtherApps(true);
                }
                let _ = sender.send(Ok(application.isActive()));
            })
            .map_err(|_| LocationFailure::from("无法激活日历以申请定位权限"))?;
            match receiver.recv_timeout(Duration::from_millis(250)) {
                Ok(Ok(true)) => return Ok(()),
                Ok(Err(error)) => return Err(error),
                _ => std::thread::sleep(Duration::from_millis(50)),
            }
        }
        Err(LocationFailure::from("请保持 i日历在前台后重试定位"))
    })
    .await
    .map_err(|_| LocationFailure::from("定位授权请求中断"))?
}

/// 超时也会停止系统请求并解除委托，迟到回调不会污染下一次定位。
pub async fn locate(
    app: tauri::AppHandle,
    id: u64,
    request_permission: bool,
) -> Result<LocationFix, LocationFailure> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Err("隔离冒烟不请求真实定位权限".into());
    }
    let enabled = tauri::async_runtime::spawn_blocking(|| unsafe {
        CLLocationManager::locationServicesEnabled_class()
    })
    .await
    .map_err(|_| "系统定位服务状态读取失败")?;
    if !enabled {
        return Err(LocationFailure::permission(
            "services-disabled",
            "系统定位服务已关闭。请打开定位设置启用定位服务，或手动选择城市",
        ));
    }
    #[cfg(target_os = "macos")]
    if request_permission {
        ensure_foreground(app.clone(), id).await?;
    }
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || begin(id, request_permission, sender))
        .map_err(|_| "定位服务无法启动")?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(if request_permission {
                60
            } else {
                30
            }))
            .unwrap_or_else(|_| Err("定位超时，请重试或手动选择城市".into()))
    })
    .await
    .map_err(|_| "定位请求中断")?;
    let _ = app.run_on_main_thread(move || {
        PENDING.with(|pending| {
            if pending
                .borrow()
                .as_ref()
                .is_some_and(|request| request.id == id)
            {
                if let Some(request) = pending.borrow_mut().take() {
                    unsafe {
                        request.manager.stopUpdatingLocation();
                        request.manager.setDelegate(None);
                    }
                }
            }
        })
    });
    result
}

/// 地名解析失败不影响坐标；仅返回省、市、区县及道路，不返回门牌与住宅名称。
pub async fn describe(
    app: tauri::AppHandle,
    id: u64,
    latitude: f64,
    longitude: f64,
) -> Result<Option<String>, String> {
    if !latitude.is_finite()
        || latitude.abs() > 90.0
        || !longitude.is_finite()
        || longitude.abs() > 180.0
    {
        return Err("经纬度无效".into());
    }
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Ok(None);
    }
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || unsafe {
        if was_cancelled(id) {
            let _ = sender.send(None);
            return;
        }
        let location =
            CLLocation::initWithLatitude_longitude(CLLocation::alloc(), latitude, longitude);
        let geocoder = CLGeocoder::new();
        let locale =
            NSLocale::initWithLocaleIdentifier(NSLocale::alloc(), ns_string!("zh_Hans_CN"));
        let completion = RcBlock::new(
            move |places: *mut NSArray<CLPlacemark>, _error: *mut NSError| {
                let label = places
                    .as_ref()
                    .and_then(|places| places.firstObject())
                    .and_then(|place| {
                        let mut parts = Vec::new();
                        for value in [
                            place.administrativeArea(),
                            place.locality(),
                            place.subAdministrativeArea(),
                            place.subLocality(),
                            place.thoroughfare(),
                        ]
                        .into_iter()
                        .flatten()
                        {
                            let text = value.to_string();
                            if !text.is_empty() && !parts.contains(&text) {
                                parts.push(text);
                            }
                        }
                        let text = parts.join(" · ");
                        if text.is_empty() {
                            None
                        } else {
                            Some(text.chars().take(100).collect::<String>())
                        }
                    });
                let _ = sender.send(label);
            },
        );
        geocoder.reverseGeocodeLocation_preferredLocale_completionHandler(
            &location,
            Some(&locale),
            &*completion as *const _ as *mut _,
        );
        GEOCODERS.with(|requests| {
            requests.borrow_mut().insert(id, geocoder);
        });
    })
    .map_err(|_| "地名解析无法启动")?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        receiver.recv_timeout(Duration::from_secs(6)).ok().flatten()
    })
    .await
    .map_err(|_| "地名解析中断")?;
    let _ = app.run_on_main_thread(move || {
        GEOCODERS.with(|requests| {
            if let Some(geocoder) = requests.borrow_mut().remove(&id) {
                unsafe {
                    geocoder.cancelGeocode();
                }
            }
        })
    });
    Ok(result)
}

/// 固定打开定位隐私面板，不放宽共享外链接口的 HTTPS 限制。
#[cfg(target_os = "macos")]
pub async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Err("隔离冒烟不打开系统设置".into());
    }
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || {
        let opened = NSURL::URLWithString(ns_string!(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
        ))
        .is_some_and(|url| NSWorkspace::sharedWorkspace().openURL(&url));
        let _ = sender.send(opened);
    })
    .map_err(|_| "定位设置无法打开")?;
    let opened = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(3))
            .unwrap_or(false)
    })
    .await
    .map_err(|_| "定位设置请求中断")?;
    if opened {
        Ok(())
    } else {
        Err("定位设置无法打开".into())
    }
}

/// 只取消对应请求；旧页面的取消消息不会停止新的定位。
pub fn cancel(app: tauri::AppHandle, id: u64) -> Result<(), String> {
    app.run_on_main_thread(move || {
        mark_cancelled(id);
        PENDING.with(|pending| {
            if pending
                .borrow()
                .as_ref()
                .is_some_and(|request| request.id == id)
            {
                if let Some(request) = pending.borrow_mut().take() {
                    request
                        ._delegate
                        .finish(&request.manager, Err("定位已取消".into()));
                    unsafe {
                        request.manager.setDelegate(None);
                    }
                }
            }
        });
        GEOCODERS.with(|requests| {
            if let Some(geocoder) = requests.borrow_mut().remove(&id) {
                unsafe {
                    geocoder.cancelGeocode();
                }
            }
        });
    })
    .map_err(|_| "定位取消失败".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn permission_prompt_requires_user_action_and_waits_for_system_choice() {
        assert_eq!(
            authorization_action(CLAuthorizationStatus::NotDetermined, false, false, false),
            AuthorizationAction::PermissionRequired
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::NotDetermined, true, false, false),
            AuthorizationAction::Request
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::NotDetermined, true, true, false),
            AuthorizationAction::Wait
        );
    }
    #[test]
    fn authorized_callback_starts_once_and_denial_never_reprompts() {
        assert_eq!(
            authorization_action(
                CLAuthorizationStatus::AuthorizedWhenInUse,
                true,
                true,
                false
            ),
            AuthorizationAction::Locate
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::AuthorizedAlways, false, false, false),
            AuthorizationAction::Locate
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::AuthorizedWhenInUse, true, true, true),
            AuthorizationAction::Wait
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::Denied, true, false, false),
            AuthorizationAction::Denied
        );
        assert_eq!(
            authorization_action(CLAuthorizationStatus::Restricted, true, false, false),
            AuthorizationAction::Restricted
        );
    }
    #[test]
    fn cancellation_before_start_does_not_request_system_permission() {
        mark_cancelled(9101);
        let (sender, receiver) = mpsc::channel();
        begin(9101, false, sender);
        assert_eq!(
            receiver
                .recv()
                .unwrap()
                .err()
                .map(|error| error.message)
                .as_deref(),
            Some("定位已取消")
        );
        assert!(!was_cancelled(9102));
    }
    #[test]
    fn validates_system_coordinates_and_accuracy() {
        let mut fix = LocationFix {
            latitude: 39.9,
            longitude: 116.4,
            accuracy: 80.0,
            timestamp: 1.0,
        };
        assert!(valid_fix(&fix));
        fix.accuracy = -1.0;
        assert!(!valid_fix(&fix));
        fix.accuracy = 80.0;
        fix.latitude = f64::NAN;
        assert!(!valid_fix(&fix));
        fix.latitude = 91.0;
        assert!(!valid_fix(&fix));
    }
}
