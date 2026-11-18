import { getSunlight } from '@i-calendar/core';
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { CalendarButton, Spinner } from './CalendarButton.js';
import type { CalendarController, CalendarSnapshot } from './store.js';

const PlaceSearch = lazy(() => import('./SunlightPlaceSearch.js'));
class PlaceSearchBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">地点列表未能载入，请刷新或重启后重试。仍可使用当前位置。</p>
    ) : (
      this.props.children
    );
  }
}
const accuracyLabel = (accuracy: number) =>
  accuracy < 1000
    ? `约 ${Math.max(1, Math.ceil(accuracy))} 米`
    : `约 ${(accuracy / 1000).toFixed(1)} 公里`;
function locationFor(state: CalendarSnapshot) {
  return state.preferences.sunlight.mode === 'automatic'
    ? state.sunlightLocation.point
    : state.preferences.sunlight.mode === 'manual'
      ? state.preferences.sunlight.manualLocation
      : null;
}
function locationName(state: CalendarSnapshot) {
  const place = state.preferences.sunlight.manualLocation;
  return state.preferences.sunlight.mode === 'automatic'
    ? (state.sunlightLocation.point?.label ?? '当前位置')
    : place
      ? `${place.region} · ${place.name}`
      : '未设置位置';
}

/** 首页只保留有效位置对应的三项日照结果，定位与说明集中在设置页。 */
export function SunlightSummary({ state }: { state: CalendarSnapshot }) {
  const point = locationFor(state);
  if (
    !point ||
    (state.preferences.sunlight.mode === 'automatic' &&
      (state.sunlightLocation.pending || state.sunlightLocation.error))
  )
    return null;
  const day = getSunlight(state.selected.date, point);
  return (
    <section
      aria-label="日出日落"
      className="tw-mt-2 tw-border-0 tw-border-b tw-border-solid tw-border-line tw-pb-2"
    >
      <dl
        aria-label="日照时间（北京时间）"
        className="tw-m-0 tw-flex tw-flex-wrap tw-items-baseline tw-gap-x-3 tw-gap-y-1 tw-text-[11px] tw-leading-5 [&>div]:tw-flex [&>div]:tw-items-baseline [&>div]:tw-gap-1 [&_dd]:tw-m-0 [&_dd]:tw-font-medium [&_dd]:tw-tabular-nums [&_dd]:tw-text-ink [&_dt]:tw-text-secondary"
      >
        <div>
          <dt>日出</dt>
          <dd>{day.sunrise ?? '无'}</dd>
        </div>
        <div>
          <dt>日落</dt>
          <dd>{day.sunset ?? '无'}</dd>
        </div>
        <div>
          <dt>白昼</dt>
          <dd>
            {Math.floor(day.daylightMinutes / 60)}时
            {(day.daylightMinutes % 60).toString().padStart(2, '0')}分
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** 跨端共用的位置设置，选择城市不触发系统定位权限。 */
export function SunlightSettings({
  controller,
  state,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
}) {
  const [search, setSearch] = useState(false);
  const manualButton = useRef<HTMLButtonElement>(null);
  const point = locationFor(state);
  const closeSearch = () => {
    setSearch(false);
    manualButton.current?.focus();
  };
  const located =
    state.preferences.sunlight.mode === 'automatic' ? state.sunlightLocation.point : null;
  return (
    <section aria-labelledby="sunlight-settings-title">
      <h2 id="sunlight-settings-title">日出日落</h2>
      <p>
        {point ? locationName(state) : '选择国内地点，或使用实际位置计算日出、日落和白昼时长。'}
      </p>
      {state.preferences.sunlight.mode === 'manual' ? (
        <p>使用手动地点参考坐标；日照时间为北京时间。</p>
      ) : located ? (
        <p>
          上次定位：
          {new Date(located.timestamp).toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
          })}
          ；日照时间为北京时间。
        </p>
      ) : null}
      <div className="tw-mb-2 tw-flex tw-flex-wrap tw-gap-2">
        {controller.platform.locate ? (
          <CalendarButton
            appearance="primary"
            disabled={state.sunlightLocation.pending}
            aria-busy={state.sunlightLocation.pending}
            icon={state.sunlightLocation.pending ? <Spinner /> : undefined}
            onClick={() => {
              void controller.locateSunlight();
            }}
          >
            {state.sunlightLocation.pending
              ? '正在请求定位…'
              : state.sunlightLocation.issue === 'permission-required'
                ? '申请定位权限'
                : state.sunlightLocation.issue === 'permission-denied'
                  ? '重新检查权限'
                  : state.preferences.sunlight.mode === 'automatic'
                    ? '重新定位'
                    : '使用当前位置'}
          </CalendarButton>
        ) : null}
        {state.sunlightLocation.pending ? (
          <CalendarButton onClick={() => controller.cancelSunlightLocation()}>
            取消定位
          </CalendarButton>
        ) : null}
        {controller.platform.openLocationSettings ? (
          <CalendarButton
            onClick={() => {
              controller.cancelSunlightLocation();
              void controller.platform
                .openLocationSettings?.()
                .catch(() =>
                  controller.reportError('定位设置无法打开，请在系统设置中查看定位服务。'),
                );
            }}
          >
            打开定位设置
          </CalendarButton>
        ) : null}
        <CalendarButton
          ref={manualButton}
          aria-expanded={search}
          aria-controls="sunlight-place-search"
          onClick={() => setSearch(!search)}
        >
          手动选择城市
        </CalendarButton>
        {state.preferences.sunlight.mode !== 'off' ? (
          <CalendarButton
            appearance="text"
            onClick={() => {
              void controller.setPreferences({
                sunlight: { ...state.preferences.sunlight, mode: 'off' },
              });
            }}
          >
            关闭显示
          </CalendarButton>
        ) : null}
      </div>
      {search ? (
        <div id="sunlight-place-search">
          <PlaceSearchBoundary>
            <Suspense fallback={<output className="tw-block">正在载入地点…</output>}>
              <PlaceSearch
                onClose={closeSearch}
                onSelect={(place) => {
                  void controller.selectSunlightPlace(place);
                  closeSearch();
                }}
              />
            </Suspense>
          </PlaceSearchBoundary>
        </div>
      ) : null}
      {state.sunlightLocation.pending ? (
        <output className="tw-mb-2 tw-block tw-text-[12px] tw-leading-[1.8] tw-text-secondary">
          正在等待定位，可取消或手动选择城市；未出现授权提示时请检查定位权限。
        </output>
      ) : null}
      {state.preferences.sunlight.mode === 'automatic' && state.sunlightLocation.error ? (
        <p
          role="alert"
          className="!tw-text-red"
        >
          {state.sunlightLocation.error}
        </p>
      ) : null}
      {located ? (
        <p>
          经度 {located.longitude.toFixed(5)}°，纬度 {located.latitude.toFixed(5)}°；定位精度
          {accuracyLabel(located.accuracy)}。
          {located.accuracy > 10_000 ? '当前定位较粗，可重新定位或选择更接近的地点。' : ''}
        </p>
      ) : null}
      <p>
        自动定位直接使用经纬度，不用市中心代替当前位置；地名尽量细到区县或道路，以系统结果为准。定位坐标仅留在本次会话，不保存历史轨迹。
      </p>
      <p>
        启用后仅在前台按需刷新，不持续追踪。系统定位和地名解析可能联网；手动地点及日照计算可离线使用。时间为理想地平线估算，不计山体、建筑与天气遮挡。
      </p>
    </section>
  );
}

/** 启用后才在可见页面恢复定位，后台启动与隐藏页面不会主动请求。 */
export function useSunlightLocation(
  controller: CalendarController,
  ready: boolean,
  mode: CalendarSnapshot['preferences']['sunlight']['mode'],
) {
  useEffect(() => {
    if (!ready || mode !== 'automatic' || !controller.platform.locate) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden' && document.hasFocus())
        void controller.locateSunlight(true);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(refresh, 30 * 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(interval);
    };
  }, [controller, ready, mode]);
}
