import { useState, type CSSProperties } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarColorInput } from './CalendarColorInput.js';
import { CalendarInput } from './CalendarInput.js';
import { CalendarSegmented } from './CalendarSegmented.js';
import { CalendarSwitch } from './CalendarSwitch.js';
import {
  colorContrastIssues,
  colorTokenGroups,
  isAccentColor,
  resolveColorTheme,
  type ColorToken,
} from './color-theme.js';
import type { CalendarPreferences } from './platform.js';
import type { CalendarController } from './store.js';

function ColorRow({
  token,
  label,
  value,
  customized,
  onChange,
  onRestore,
  onInteraction,
}: {
  token: ColorToken;
  label: string;
  value: string;
  customized: boolean;
  onChange: (color: string) => void;
  onRestore: () => void;
  onInteraction: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  // 外部取色或恢复默认时同步草稿，不卸载正在使用的系统颜色面板。
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
  }
  const invalid = !isAccentColor(draft);
  const id = `custom-color-${token.slice(2)}`;
  const commit = () => {
    if (!invalid && draft.toLowerCase() !== value.toLowerCase()) onChange(draft);
  };
  return (
    <div className="tw-py-1.5">
      <div className="tw-flex tw-items-center tw-gap-2">
        <label
          className="tw-min-w-0 tw-flex-1 tw-text-[12px] tw-leading-5"
          htmlFor={id}
        >
          {label}
        </label>
        <CalendarColorInput
          aria-label={`${label}取色`}
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
          onFocus={() => onInteraction(true)}
          onBlur={() => onInteraction(false)}
        />
        <div className="tw-flex tw-w-[82px] tw-shrink-0">
          <CalendarInput
            id={id}
            value={draft.toUpperCase()}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            status={invalid ? 'error' : undefined}
            className="tw-px-1.5 tw-text-[12px] tw-tabular-nums"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Escape' && draft !== value) {
                event.preventDefault();
                event.stopPropagation();
                setDraft(value);
              }
            }}
          />
        </div>
        <CalendarButton
          appearance="text"
          disabled={!customized}
          aria-label={`恢复${label}`}
          onClick={() => {
            setDraft(value);
            onRestore();
          }}
        >
          恢复
        </CalendarButton>
      </div>
      {invalid ? (
        <output
          id={`${id}-error`}
          className="tw-block tw-pt-1 tw-text-[11px] tw-text-red"
        >
          请输入完整色值，如 #3269D9
        </output>
      ) : null}
    </div>
  );
}

/** 高级编辑区沿用基础主题以保证恢复入口可读；预览和实际界面使用完整自定义色值。 */
export function AdvancedColorSettings({
  controller,
  preferences,
  dark,
  increasedContrast,
}: {
  controller: CalendarController;
  preferences: CalendarPreferences;
  dark: boolean;
  increasedContrast: boolean;
}) {
  const [mode, setMode] = useState<'light' | 'dark'>(dark ? 'dark' : 'light');
  const custom = preferences.customColors;
  const overrides = custom[mode];
  const count = Object.keys(overrides).length;
  const base = resolveColorTheme(
    { ...preferences, customColors: undefined },
    dark,
    increasedContrast,
  ).tokens;
  const preview = resolveColorTheme(
    { ...preferences, customColors: { ...custom, enabled: true } },
    mode === 'dark',
    increasedContrast,
  ).tokens;
  const fallback = resolveColorTheme(
    { ...preferences, customColors: undefined },
    mode === 'dark',
    increasedContrast,
  ).tokens;
  const issues = colorContrastIssues(preview, increasedContrast);
  const update = (token: ColorToken, value?: string) => {
    const next = { ...overrides };
    if (value === undefined) delete next[token];
    else next[token] = value;
    void controller.setPreferences({ customColors: { ...custom, [mode]: next } });
  };
  const interact = (busy: boolean) => {
    void controller.platform.setInteractionBusy?.(busy);
  };
  return (
    <details
      className="advanced-colors tw-mt-4 tw-bg-surface tw-text-ink"
      style={base as CSSProperties}
    >
      <summary className="tw-cursor-pointer tw-rounded tw-py-2 tw-text-[13px] tw-font-medium focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-secondary">
        高级配色{' '}
        <span className="tw-ml-1 tw-text-[11px] tw-font-normal tw-text-secondary">
          {custom.enabled ? '已启用' : '未启用'}
        </span>
      </summary>
      <div className="tw-pb-1 tw-pt-2">
        <div className="tw-mb-3 tw-flex tw-min-h-7 tw-items-center tw-justify-between tw-gap-2">
          <label
            htmlFor="custom-colors-enabled"
            className="tw-text-[12px]"
          >
            启用自定义配色
          </label>
          <CalendarSwitch
            id="custom-colors-enabled"
            checked={custom.enabled}
            onChange={(enabled) => {
              void controller.setPreferences({ customColors: { ...custom, enabled } });
            }}
          />
        </div>
        <p>浅色与深色分别保存，未修改的颜色跟随主题。关闭后保留选色。</p>
        <CalendarSegmented
          aria-label="编辑配色外观"
          value={mode}
          options={[
            { label: '浅色配色', value: 'light' },
            { label: '深色配色', value: 'dark' },
          ]}
          onChange={(value) => setMode(value as 'light' | 'dark')}
        />
        <div
          className="tw-my-3 tw-bg-canvas tw-p-3"
          style={{ ...preview, colorScheme: mode } as CSSProperties}
          aria-label={`${mode === 'dark' ? '深色' : '浅色'}配色预览`}
        >
          <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-lg tw-bg-surface tw-p-3 tw-text-ink">
            <span className="tw-flex tw-h-11 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-leaf tw-text-[24px] tw-text-[var(--leaf-ink)]">
              12
            </span>
            <div className="tw-min-w-0 tw-text-[12px] tw-leading-5">
              <div>
                11月12日 <span className="tw-text-secondary">周四</span>
              </div>
              <div className="tw-text-[var(--lunar-ink)]">农历十月初四</div>
              <div className="tw-flex tw-flex-wrap tw-gap-2">
                <span className="tw-text-red">休假</span>
                <span className="tw-text-green">节气</span>
                <span className="tw-text-yellow">补班</span>
                <span className="tw-text-[var(--purple)]">节日</span>
              </div>
            </div>
          </div>
        </div>
        {issues.length ? (
          <details className="tw-mb-3 tw-text-[11px] tw-leading-5 tw-text-secondary">
            <summary className="tw-cursor-pointer">
              有 {issues.length} 组颜色对比度偏低，展开查看
            </summary>
            <ul className="tw-my-1 tw-pl-5">
              {issues.map((issue) => (
                <li key={issue.token}>
                  {issue.label}：{issue.ratio.toFixed(2)}:1，建议至少 {issue.minimum}:1
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <output className="tw-mb-3 tw-block tw-text-[11px] tw-leading-5 tw-text-secondary">
            当前预览的常用文字与控件对比度通过检查。
          </output>
        )}
        {colorTokenGroups.map((group, index) => (
          <details
            key={group.label}
            open={index === 0}
            className="tw-border-0 tw-border-t tw-border-solid tw-border-line tw-py-2"
          >
            <summary className="tw-cursor-pointer tw-py-1 tw-text-[12px] tw-font-medium focus-visible:tw-outline focus-visible:tw-outline-1 focus-visible:tw-outline-secondary">
              {group.label}
            </summary>
            {group.items.map((item) => (
              <ColorRow
                key={`${mode}-${item.key}`}
                token={item.key}
                label={item.label}
                value={overrides[item.key] ?? fallback[item.key]}
                customized={overrides[item.key] !== undefined}
                onChange={(value) => update(item.key, value)}
                onRestore={() => update(item.key)}
                onInteraction={interact}
              />
            ))}
          </details>
        ))}
        <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <CalendarButton
            disabled={!count}
            onClick={() => {
              void controller.setPreferences({ customColors: { ...custom, [mode]: {} } });
            }}
          >
            恢复当前配色
          </CalendarButton>
          <CalendarButton
            appearance="text"
            disabled={
              !custom.enabled &&
              !Object.keys(custom.light).length &&
              !Object.keys(custom.dark).length
            }
            onClick={() => {
              void controller.setPreferences({
                customColors: { enabled: false, light: {}, dark: {} },
              });
            }}
          >
            全部恢复默认
          </CalendarButton>
          <span className="tw-text-[11px] tw-text-secondary">已自定义 {count} 项</span>
        </div>
        <p className="tw-pt-2">
          高级颜色按原值应用。编辑区保持基础配色，方便随时恢复；品牌图标保持原色。
        </p>
      </div>
    </details>
  );
}
