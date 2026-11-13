import { useEffect, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarInput } from './CalendarInput.js';
import { CalendarSelect } from './CalendarSelect.js';
import { CalendarSwitch } from './CalendarSwitch.js';
import {
  formatMenuClock,
  menuClockPresets,
  parseMenuClock,
  type MenuClockPreferences,
} from './menu-clock.js';

const modeFor = (format: string) =>
  menuClockPresets.some((item) => item.value === format) ? format : 'custom';
const formatOptions = [...menuClockPresets, { value: 'custom', label: '自定义' }];

/** 仅供 Mac 菜单栏使用；预览遵循系统时区，输入校验通过后才保存。 */
export function MenuClockSettings({
  settings,
  onChange,
}: {
  settings: MenuClockPreferences;
  onChange: (settings: MenuClockPreferences) => void;
}) {
  const [mode, setMode] = useState(() => modeFor(settings.format));
  const [draft, setDraft] = useState(settings.format);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  let error = '';
  try {
    parseMenuClock({ ...settings, format: draft });
  } catch (reason) {
    error = reason instanceof Error ? reason.message : '格式无效';
  }
  const preview = error ? '请输入有效格式' : formatMenuClock(draft, now);
  return (
    <section
      className="menu-clock-settings"
      aria-labelledby="menu-clock-title"
    >
      <h2 id="menu-clock-title">菜单栏显示</h2>
      <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
        <label htmlFor="menu-clock-icon">显示图标</label>
        <CalendarSwitch
          id="menu-clock-icon"
          checked={settings.showIcon}
          disabled={!settings.enabled || !formatMenuClock(settings.format, now).trim()}
          aria-describedby="menu-entry-hint"
          onChange={(showIcon) => onChange({ ...settings, showIcon })}
        />
      </div>
      <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
        <label htmlFor="menu-clock-enabled">显示菜单栏时间</label>
        <CalendarSwitch
          id="menu-clock-enabled"
          checked={settings.enabled}
          disabled={!settings.showIcon}
          aria-describedby="menu-entry-hint"
          onChange={(enabled) => onChange({ ...settings, enabled })}
        />
      </div>
      <div className="setting-label tw-mb-3 tw-flex tw-min-h-[var(--form-height)] tw-items-center tw-justify-between tw-gap-[var(--form-gap)] tw-text-[length:var(--form-font-size)] coarse:tw-min-h-11">
        <label htmlFor="menu-clock-format">展示格式</label>
        <CalendarSelect
          id="menu-clock-format"
          className="clock-format-select tw-w-[188px] tw-max-w-[65%]"
          label="展示格式"
          value={mode}
          options={formatOptions}
          popupWidth={208}
          onChange={(format) => {
            setMode(format);
            if (format !== 'custom') {
              setDraft(format);
              onChange({ ...settings, format });
            }
          }}
        />
      </div>
      {mode === 'custom' ? (
        <form
          className="clock-format-form tw-mb-2 tw-flex tw-gap-[var(--form-gap)] coarse:tw-min-h-11 coarse:tw-items-center [&_.calendar-button]:tw-shrink-0 [&_.calendar-input-field]:tw-min-w-0 [&_.calendar-input-field]:tw-tabular-nums"
          onSubmit={(event) => {
            event.preventDefault();
            if (!error) onChange({ ...settings, format: draft });
          }}
        >
          <label
            className="sr-only"
            htmlFor="menu-clock-custom"
          >
            自定义时间格式
          </label>
          <CalendarInput
            id="menu-clock-custom"
            value={draft}
            maxLength={48}
            placeholder="YYYY-MM-DD ddd HH:mm:ss"
            status={error ? 'error' : undefined}
            aria-invalid={!!error}
            aria-describedby="clock-format-help clock-format-error"
            onChange={(event) => setDraft(event.target.value)}
          />
          <CalendarButton
            type="submit"
            disabled={!!error || draft === settings.format}
          >
            应用格式
          </CalendarButton>
        </form>
      ) : null}
      {mode === 'custom' ? (
        <>
          <p
            id="clock-format-help"
            className="clock-help"
          >
            支持 YYYY、YY、MM、DD、ddd、dddd、HH、hh、mm、ss、A。M、D、H、h、m、s
            为不补零形式；普通英文放在 [方括号] 中。
          </p>
          <output
            id="clock-format-error"
            className="clock-format-error"
            aria-live="polite"
          >
            {error}
          </output>
        </>
      ) : null}
      <div className="clock-preview-row tw-mx-0 tw-my-2 tw-flex tw-flex-wrap tw-items-baseline tw-justify-between tw-gap-[6px_12px] tw-rounded-[8px] tw-bg-control tw-px-2.5 tw-py-[9px] tw-text-[length:11px] tw-leading-[20px] tw-text-secondary [&_output]:tw-text-[length:12px] [&_output]:tw-tabular-nums [&_output]:tw-text-ink [&_output]:tw-overflow-anywhere">
        <span>{settings.enabled ? '时间格式预览' : '时间格式预览（时间已关闭）'}</span>
        <output
          aria-label="菜单栏时间预览"
          aria-live="off"
        >
          {preview}
        </output>
      </div>
      <p id="menu-entry-hint">图标和有效的时间文字至少保留一项。</p>
      <p>时间跟随 Mac 系统时区，弹窗收起后继续刷新。日历日期仍按北京时间查询。</p>
    </section>
  );
}
