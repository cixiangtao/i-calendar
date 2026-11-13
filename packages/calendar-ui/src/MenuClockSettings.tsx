import Switch from 'antd/es/switch';
import { useEffect, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarInput } from './CalendarInput.js';
import { CalendarSelect } from './CalendarSelect.js';
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
      <div className="setting-label">
        <label htmlFor="menu-clock-icon">显示图标</label>
        <Switch
          id="menu-clock-icon"
          checked={settings.showIcon}
          disabled={!settings.enabled || !formatMenuClock(settings.format, now).trim()}
          aria-describedby="menu-entry-hint"
          onChange={(showIcon) => onChange({ ...settings, showIcon })}
        />
      </div>
      <div className="setting-label">
        <label htmlFor="menu-clock-enabled">显示菜单栏时间</label>
        <Switch
          id="menu-clock-enabled"
          checked={settings.enabled}
          disabled={!settings.showIcon}
          aria-describedby="menu-entry-hint"
          onChange={(enabled) => onChange({ ...settings, enabled })}
        />
      </div>
      <div className="setting-label">
        <label htmlFor="menu-clock-format">展示格式</label>
        <CalendarSelect
          id="menu-clock-format"
          className="clock-format-select"
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
          className="clock-format-form"
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
            htmlType="submit"
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
      <div className="clock-preview-row">
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
