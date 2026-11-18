import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarColorInput } from './CalendarColorInput.js';
import { CalendarInput } from './CalendarInput.js';
import { CalendarSegmented } from './CalendarSegmented.js';
import { CalendarSelect } from './CalendarSelect.js';
import { CalendarSlider } from './CalendarSlider.js';
import type { CalendarPlatform } from './platform.js';
import type { CalendarSnapshot } from './store.js';
import {
  formatThemeColor,
  formatThemeColorField,
  normalizeThemeColorField,
  parseThemeColor,
  type ThemeColorFormat,
} from './theme-color.js';
import { prepareThemeImage } from './theme-image.js';
import type { CalendarThemePackage, ThemeBackground, ThemePalette } from './theme-package.js';
import { ThemeFilePicker } from './ThemeFilePicker.js';
import { ThemePreview } from './ThemePreview.js';

const appearanceOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
] as const;
const colorFormatOptions = [
  { label: 'HEX', value: 'hex' },
  { label: 'RGBA', value: 'rgba' },
] as const;
const easyColors = [
  { key: 'canvas', label: '页面背景' },
  { key: 'surface', label: '卡片底色' },
  { key: 'accent', label: '操作强调色' },
] as const;
const moreColors = [
  { key: 'ink', label: '主要文字' },
  { key: 'red', label: '休假与警告' },
  { key: 'green', label: '节气与工作日' },
  { key: 'yellow', label: '补班与提醒' },
  { key: 'purple', label: '节日' },
] as const;
type Mode = 'light' | 'dark';
type ColorKey = keyof ThemePalette;
const supportsAlpha = (key: ColorKey) => key === 'canvas' || key === 'surface';
type TextInputs = Partial<Record<Mode, Partial<Record<ColorKey, string>>>>;

/** 在本地草稿中编辑主题，保存前只改变预览。 */
export function ThemeEditor({
  initial,
  state,
  dark,
  increasedContrast,
  platform,
  saving,
  onCancel,
  onSave,
}: {
  initial: CalendarThemePackage;
  state: CalendarSnapshot;
  dark: boolean;
  increasedContrast: boolean;
  platform: CalendarPlatform;
  saving: boolean;
  onCancel: () => void;
  onSave: (theme: CalendarThemePackage) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [mode, setMode] = useState<Mode>(dark ? 'dark' : 'light');
  const [format, setFormat] = useState<ThemeColorFormat>('hex');
  const [inputs, setInputs] = useState<TextInputs>({});
  const [readingImage, setReadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { background } = draft;
  const previewTheme = useMemo(() => {
    const colors = inputs[mode];
    if (!colors) return draft;
    const palette = { ...draft.palettes[mode] };
    for (const [name, text] of Object.entries(colors)) {
      const key = name as ColorKey;
      const color = text === undefined ? null : normalizeThemeColorField(text, supportsAlpha(key));
      if (color !== null) palette[key] = color;
    }
    return { ...draft, palettes: { ...draft.palettes, [mode]: palette } };
  }, [draft, inputs, mode]);
  const invalid = (['light', 'dark'] as const).some((look) =>
    Object.entries(inputs[look] ?? {}).some(
      ([key, value]) =>
        value !== undefined &&
        normalizeThemeColorField(value, supportsAlpha(key as ColorKey)) === null,
    ),
  );
  function updateColor(key: ColorKey, value: string) {
    setDraft((current) => ({
      ...current,
      palettes: { ...current.palettes, [mode]: { ...current.palettes[mode], [key]: value } },
    }));
  }
  function discardInput(key: ColorKey) {
    setInputs((current) => ({ ...current, [mode]: { ...current[mode], [key]: undefined } }));
  }
  function colorRow({ key, label }: { key: ColorKey; label: string }) {
    const color = parseThemeColor(previewTheme.palettes[mode][key])!;
    const value = inputs[mode]?.[key] ?? formatThemeColorField(color, format);
    const isInvalid =
      inputs[mode]?.[key] !== undefined &&
      normalizeThemeColorField(value, supportsAlpha(key)) === null;
    return (
      <div
        key={key}
        className="tw-grid tw-gap-0.5"
      >
        <div className="tw-grid tw-min-h-8 tw-grid-cols-[4.5rem_minmax(0,_1fr)_auto] tw-items-center tw-gap-x-1.5 coarse:tw-min-h-11">
          <label
            htmlFor={id + key}
            className="tw-text-xs tw-font-medium"
          >
            {label}
          </label>
          <div className="tw-flex tw-min-w-0">
            <CalendarInput
              id={id + key}
              className="tw-tabular-nums"
              spellCheck={false}
              autoComplete="off"
              value={value}
              maxLength={100}
              status={isInvalid ? 'error' : undefined}
              aria-invalid={isInvalid || undefined}
              aria-describedby={isInvalid ? id + key + '-error' : undefined}
              onChange={(event) => {
                const text = event.currentTarget.value;
                setInputs((current) => ({ ...current, [mode]: { ...current[mode], [key]: text } }));
              }}
              onBlur={() => {
                if (inputs[mode]?.[key] === undefined) return;
                const normalized = normalizeThemeColorField(value, supportsAlpha(key));
                if (normalized !== null) {
                  updateColor(key, normalized);
                  discardInput(key);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  discardInput(key);
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
          <div className="tw-flex">
            <CalendarColorInput
              aria-label={label + '取色'}
              value={formatThemeColor({ ...color, alpha: 1 }, 'hex')}
              onFocus={() => void platform.setInteractionBusy?.(true)}
              onBlur={() => void platform.setInteractionBusy?.(false)}
              onChange={(event) => {
                const picked = parseThemeColor(event.currentTarget.value);
                if (picked) {
                  const opacity = color.alpha;
                  updateColor(
                    key,
                    formatThemeColor({ ...picked, alpha: opacity }, opacity === 1 ? 'hex' : 'rgba'),
                  );
                  discardInput(key);
                }
              }}
            />
          </div>
        </div>
        {isInvalid ? (
          <p
            id={id + key + '-error'}
            className="!tw-m-0 tw-text-xs !tw-text-red"
          >
            {supportsAlpha(key)
              ? '请输入 HEX 或 RGBA 色值。'
              : '请输入有效的实色，透明度需为 100%。'}
          </p>
        ) : null}
      </div>
    );
  }
  function updateBackground(changes: Partial<ThemeBackground>) {
    setDraft((current) =>
      current.background
        ? { ...current, background: { ...current.background, ...changes } }
        : current,
    );
  }
  async function chooseImage(file: File) {
    setReadingImage(true);
    setImageError('');
    try {
      const image = await prepareThemeImage(file);
      setDraft((current) => ({
        ...current,
        background: { strength: current.background?.strength ?? 78, x: 50, y: 50, image },
      }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '无法读取背景图');
    } finally {
      setReadingImage(false);
    }
  }

  return (
    <form
      className="tw-grid tw-gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid && draft.name.trim() && !readingImage && !saving) onSave(previewTheme);
      }}
    >
      <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
        <h2
          ref={heading}
          tabIndex={-1}
          className="!tw-m-0"
        >
          编辑主题
        </h2>
        <CalendarSegmented
          aria-label="编辑外观"
          options={appearanceOptions}
          value={mode}
          onChange={(value) => setMode(value as Mode)}
        />
      </div>
      <ThemePreview
        theme={previewTheme}
        mode={mode}
        state={state}
        increasedContrast={increasedContrast}
      />
      <div className="tw-flex tw-items-center tw-gap-1.5">
        <label
          htmlFor={id + '-name'}
          className="tw-w-20 tw-shrink-0 tw-text-xs tw-font-medium"
        >
          主题名称
        </label>
        <CalendarInput
          id={id + '-name'}
          value={draft.name}
          required
          maxLength={64}
          onChange={(event) => {
            const name = event.currentTarget.value;
            setDraft((current) => ({ ...current, name }));
          }}
        />
      </div>
      <section className="tw-grid tw-gap-1.5">
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
          <h3 className="tw-my-0 tw-text-[13px] tw-font-semibold">配色</h3>
          <CalendarSelect
            label="颜色显示格式"
            value={format}
            options={colorFormatOptions}
            onChange={setFormat}
          />
        </div>
        {easyColors.map(colorRow)}
        <details className="tw-border-0 tw-border-t tw-border-solid tw-border-line">
          <summary className="tw-cursor-pointer tw-py-2 tw-text-xs tw-font-medium">
            更多颜色
          </summary>
          <div className="tw-grid tw-gap-1.5">{moreColors.map(colorRow)}</div>
        </details>
      </section>
      <section className="tw-grid tw-gap-2 tw-border-0 tw-border-t tw-border-solid tw-border-line tw-pt-2.5">
        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
          <h3 className="tw-my-0 tw-text-[13px] tw-font-semibold">背景图</h3>
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <ThemeFilePicker
              platform={platform}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              label={background ? '替换图片…' : '选取图片…'}
              loading={readingImage}
              onFile={(file) => void chooseImage(file)}
            />
            {background ? (
              <CalendarButton
                appearance="text"
                disabled={readingImage}
                onClick={() => {
                  setImageError('');
                  setDraft((current) => ({ ...current, background: undefined }));
                }}
              >
                移除图片
              </CalendarButton>
            ) : null}
          </div>
        </div>
        {imageError ? (
          <p
            role="alert"
            className="!tw-m-0 !tw-text-red"
          >
            {imageError}
          </p>
        ) : null}
        {background ? (
          <>
            <CalendarSlider
              label="图片强度"
              value={background.strength}
              onChange={(strength) => updateBackground({ strength })}
            />
            <details>
              <summary className="tw-cursor-pointer tw-py-1.5 tw-text-xs tw-font-medium">
                调整裁切
              </summary>
              <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                <CalendarSlider
                  label="水平位置"
                  value={background.x}
                  onChange={(x) => updateBackground({ x })}
                />
                <CalendarSlider
                  label="垂直位置"
                  value={background.y}
                  onChange={(y) => updateBackground({ y })}
                />
              </div>
            </details>
          </>
        ) : null}
      </section>
      <div className="tw-flex tw-flex-wrap tw-justify-end tw-gap-2">
        <CalendarButton
          onClick={onCancel}
          disabled={saving}
        >
          取消
        </CalendarButton>
        <CalendarButton
          type="submit"
          appearance="primary"
          loading={saving}
          disabled={invalid || !draft.name.trim() || readingImage}
        >
          保存并应用
        </CalendarButton>
      </div>
    </form>
  );
}
