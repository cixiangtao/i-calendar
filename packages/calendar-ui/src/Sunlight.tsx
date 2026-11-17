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

import { CalendarButton } from './CalendarButton.js';
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

/** 日期详情中的紧凑日照摘要，没有有效位置时不展示猜测时间。 */
export function SunlightSummary({
  controller,
  state,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
}) {
  const point = locationFor(state);
  const change = () => controller.showSettings();
  if (!point)
    return (
      <div className="tw-mt-2 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-1.5">
        <CalendarButton
          appearance="text"
          onClick={change}
          aria-label="设置日出日落位置"
        >
          日出日落 ·{' '}
          {state.sunlightLocation.pending
            ? '正在定位…'
            : state.sunlightLocation.error
              ? '定位失败，选择位置'
              : '设置位置'}
        </CalendarButton>
      </div>
    );
  const day = getSunlight(state.selected.date, point);
  const located = state.sunlightLocation.point;
  const source =
    state.preferences.sunlight.mode === 'manual'
      ? '地点参考值'
      : state.sunlightLocation.pending
        ? '正在更新，暂用上次位置'
        : state.sunlightLocation.error
          ? '定位更新失败，暂用上次位置'
          : located
            ? `上次定位 ${new Date(located.timestamp).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })} · 精度${accuracyLabel(located.accuracy)}`
            : '';
  return (
    <section
      aria-label="日出日落"
      className="tw-mt-2 tw-border-0 tw-border-b tw-border-solid tw-border-line tw-pb-2"
    >
      <div className="tw-mb-1.5 tw-flex tw-min-w-0 tw-items-center tw-justify-between tw-gap-2 tw-text-[11px] tw-text-secondary">
        <span className="tw-min-w-0 tw-overflow-anywhere">{locationName(state)}</span>
        <CalendarButton
          appearance="text"
          onClick={change}
          aria-label="更改日出日落位置"
        >
          位置
        </CalendarButton>
      </div>
      <dl className="tw-m-0 tw-grid tw-grid-cols-3 tw-gap-2 [&_dd]:tw-m-0 [&_dd]:tw-text-[14px] [&_dd]:tw-font-medium [&_dd]:tw-tabular-nums [&_dd]:tw-leading-6 [&_dd]:tw-text-ink [&_dt]:tw-text-[11px] [&_dt]:tw-leading-5 [&_dt]:tw-text-secondary">
        <div>
          <dt>日出</dt>
          <dd>{day.sunrise ?? '当日无日出'}</dd>
        </div>
        <div>
          <dt>日落</dt>
          <dd>{day.sunset ?? '当日无日落'}</dd>
        </div>
        <div>
          <dt>白昼</dt>
          <dd>
            {Math.floor(day.daylightMinutes / 60)}时
            {(day.daylightMinutes % 60).toString().padStart(2, '0')}分
          </dd>
        </div>
      </dl>
      <p className="tw-mb-0 tw-mt-1 tw-text-[11px] tw-leading-[17px] tw-text-secondary">
        北京时间 · {source}
        {day.condition === 'polar-day'
          ? ' · 极昼'
          : day.condition === 'polar-night'
            ? ' · 极夜'
            : ''}
      </p>
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
      <div className="tw-mb-2 tw-flex tw-flex-wrap tw-gap-2">
        {controller.platform.locate ? (
          <CalendarButton
            appearance="primary"
            disabled={state.sunlightLocation.pending}
            onClick={() => {
              void controller.locateSunlight();
            }}
          >
            {state.sunlightLocation.pending
              ? '正在定位…'
              : state.preferences.sunlight.mode === 'automatic'
                ? '重新定位'
                : '使用当前位置'}
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
          请在系统或浏览器提示中允许定位；也可以直接选择城市。
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
