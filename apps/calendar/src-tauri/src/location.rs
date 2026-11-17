//! 一次性系统定位。对象只在主线程持有；坐标不写磁盘、不写日志，不启动持续追踪。
// CLGeocoder 为最低系统兼容保留；较新 SDK 已建议 MapKit，但旧系统仍需此 API。
#![allow(deprecated)]

use block2::RcBlock;
use objc2::{
    define_class, msg_send, rc::Retained, runtime::ProtocolObject, AnyThread, DefinedClass,
    MainThreadOnly,
};
use objc2_core_location::{
    kCLLocationAccuracyBest, CLAuthorizationStatus, CLGeocoder, CLLocation, CLLocationManager,
    CLLocationManagerDelegate, CLPlacemark,
};
use objc2_foundation::{
    ns_string, MainThreadMarker, NSArray, NSError, NSLocale, NSObject, NSObjectProtocol,
};
use serde::Serialize;
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
    sender: RefCell<Option<mpsc::Sender<Result<LocationFix, String>>>>,
    started: Cell<bool>,
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
            let message = if error.code() == 1 {
                "定位权限未开启，请在系统设置中允许 i日历使用定位，或手动选择城市"
            } else {
                "暂时无法获取位置，请检查网络与定位服务，或手动选择城市"
            };
            self.finish(manager, Err(message.into()));
        }

        #[unsafe(method(locationManagerDidChangeAuthorization:))]
        fn authorization(&self, manager: &CLLocationManager) {
            self.start_if_authorized(manager);
        }
    }
);

impl LocationDelegate {
    fn finish(&self, manager: &CLLocationManager, result: Result<LocationFix, String>) {
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
        let status = unsafe { manager.authorizationStatus() };
        if status == CLAuthorizationStatus::Denied || status == CLAuthorizationStatus::Restricted {
            self.finish(
                manager,
                Err("定位权限未开启，请在系统设置中允许 i日历使用定位，或手动选择城市".into()),
            );
        } else if status == CLAuthorizationStatus::AuthorizedAlways
            || status == CLAuthorizationStatus::AuthorizedWhenInUse
        {
            if !self.ivars().started.replace(true) {
                unsafe {
                    manager.requestLocation();
                }
            }
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

fn begin(id: u64, sender: mpsc::Sender<Result<LocationFix, String>>) {
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
        if unsafe { manager.authorizationStatus() } == CLAuthorizationStatus::NotDetermined {
            #[cfg(target_os = "macos")]
            unsafe {
                // macOS 在首次请求坐标时自动弹出系统授权。
                delegate.ivars().started.set(true);
                manager.requestLocation();
            }
            #[cfg(target_os = "ios")]
            unsafe {
                manager.requestWhenInUseAuthorization();
            }
        } else {
            delegate.start_if_authorized(&manager);
        }
    });
}

/// 超时也会停止系统请求并解除委托，迟到回调不会污染下一次定位。
pub async fn locate(app: tauri::AppHandle, id: u64) -> Result<LocationFix, String> {
    if std::env::args().any(|argument| argument == "--smoke-test") {
        return Err("隔离冒烟不请求真实定位权限".into());
    }
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || begin(id, sender))
        .map_err(|_| "定位服务无法启动")?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(30))
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
    fn cancellation_before_start_does_not_request_system_permission() {
        mark_cancelled(9101);
        let (sender, receiver) = mpsc::channel();
        begin(9101, sender);
        assert_eq!(
            receiver.recv().unwrap().err().as_deref(),
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
