import { useEffect, useRef, useState } from 'react';

import { CalendarButton } from './CalendarButton.js';
import type { CalendarController, CalendarSnapshot } from './store.js';
import { readThemeFile, themeBackground } from './theme-image.js';
import { activeTheme, copyTheme, isBuiltInTheme, type ThemeLibrary } from './theme-library.js';
import { builtInThemes, parseThemePackage, type CalendarThemePackage } from './theme-package.js';
import { ThemeBackgroundImage } from './ThemeBackdrop.js';
import { ThemeEditor } from './ThemeEditor.js';
import { ThemeFilePicker } from './ThemeFilePicker.js';
import { ThemePreview } from './ThemePreview.js';

type Workflow =
  | { kind: 'edit'; theme: CalendarThemePackage }
  | {
      kind: 'import';
      theme: CalendarThemePackage;
      copy: CalendarThemePackage;
      collision: 'built-in' | 'custom' | null;
    };

function packageWithImage(theme: CalendarThemePackage): CalendarThemePackage {
  if (theme.background) return theme;
  const background = themeBackground(theme);
  return background ? { ...theme, schemaVersion: 2, rulesVersion: 2, background } : theme;
}

function ThemeChoices({
  items,
  selectedId,
  label,
  disabled,
  onSelect,
}: {
  items: readonly CalendarThemePackage[];
  selectedId: string;
  label: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset
      className="tw-m-0 tw-grid tw-min-w-0 tw-grid-cols-[repeat(3,_minmax(0,_1fr))] tw-gap-2 tw-border-0 tw-p-0"
      aria-label={label}
    >
      {items.map((theme) => {
        const { canvas, accent } = theme.palettes.light;
        const background = themeBackground(theme);
        const selected = theme.id === selectedId;
        return (
          <CalendarButton
            key={theme.id}
            appearance="choice"
            className="app:tw-min-w-0 app:tw-gap-1.5 app:tw-px-1.5 app:tw-py-1.5"
            aria-pressed={selected}
            title={theme.name}
            disabled={disabled}
            onClick={() => onSelect(theme.id)}
          >
            <span
              className="tw-relative tw-grid tw-h-7 tw-w-full tw-place-items-center tw-overflow-hidden tw-rounded-[5px]"
              style={{ backgroundColor: canvas }}
              aria-hidden="true"
            >
              {background?.strength ? (
                <ThemeBackgroundImage
                  background={background}
                  loading="lazy"
                  className="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover"
                />
              ) : null}
              <span
                className="tw-relative tw-h-3 tw-w-3 tw-rounded-[4px]"
                style={{ backgroundColor: accent }}
              />
            </span>
            <span className="tw-w-full tw-truncate tw-text-center">{theme.name}</span>
          </CalendarButton>
        );
      })}
    </fieldset>
  );
}

/** 主题列表、编辑、导入预览和导出使用同一个持久化入口。 */
export function ThemeSettings({
  controller,
  state,
  dark,
  increasedContrast,
}: {
  controller: CalendarController;
  state: CalendarSnapshot;
  dark: boolean;
  increasedContrast: boolean;
}) {
  const library = state.preferences.themes;
  const selected = activeTheme(library);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [removing, setRemoving] = useState<CalendarThemePackage | null>(null);
  const [operation, setOperation] = useState<'save' | 'import' | 'export' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const importHeading = useRef<HTMLHeadingElement>(null);
  const importPreview = workflow?.kind === 'import';
  useEffect(() => {
    if (importPreview) importHeading.current?.focus();
  }, [importPreview]);

  function startEditing() {
    setFeedback(null);
    const shared = packageWithImage(selected);
    const theme =
      shared.schemaVersion === 1
        ? ({ ...shared, schemaVersion: 2, rulesVersion: 2 } as const)
        : shared;
    setWorkflow({
      kind: 'edit',
      theme: isBuiltInTheme(theme.id) ? copyTheme({ ...theme, name: theme.name + '副本' }) : theme,
    });
  }

  async function updateLibrary(next: (library: ThemeLibrary) => ThemeLibrary, message: string) {
    setFeedback(null);
    setOperation('save');
    try {
      const saved = await controller.setPreferences({
        themes: next(controller.getSnapshot().preferences.themes),
      });
      if (!saved) return;
      setWorkflow(null);
      setRemoving(null);
      if (message) setFeedback({ message, error: false });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : '主题无法保存',
        error: true,
      });
    } finally {
      setOperation(null);
    }
  }

  function applyTheme(theme: CalendarThemePackage, message: string) {
    void updateLibrary((current) => {
      const index = current.custom.findIndex((item) => item.id === theme.id);
      const custom = current.custom.slice();
      if (index < 0) custom.push(theme);
      else custom[index] = theme;
      return { selectedId: theme.id, custom };
    }, message);
  }

  async function importTheme(file: File) {
    setOperation('import');
    setFeedback(null);
    try {
      const theme = await readThemeFile(file);
      const collision = isBuiltInTheme(theme.id)
        ? 'built-in'
        : controller.getSnapshot().preferences.themes.custom.some((item) => item.id === theme.id)
          ? 'custom'
          : null;
      const suffix = '副本';
      const copy = copyTheme({ ...theme, name: theme.name.slice(0, 64 - suffix.length) + suffix });
      setWorkflow({ kind: 'import', theme, copy, collision });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : '主题无法导入',
        error: true,
      });
    } finally {
      setOperation(null);
    }
  }

  async function exportTheme() {
    setOperation('export');
    setFeedback(null);
    try {
      const theme = parseThemePackage(packageWithImage(selected));
      const filename = theme.name
        .replace(/[\p{Cc}\\/:*?"<>|]/gu, '-')
        .replace(/^[. ]+|[. ]+$/g, '');
      const exported = await controller.platform.exportTheme?.(
        (filename || 'i日历主题') + '.icaltheme',
        JSON.stringify(theme, null, 2) + '\n',
      );
      if (exported) setFeedback({ message: '主题已导出。', error: false });
    } catch (error) {
      setFeedback({
        message: typeof error === 'string' ? error : '主题导出失败，请重试。',
        error: true,
      });
    } finally {
      setOperation(null);
    }
  }

  function cancel() {
    setWorkflow(null);
    setFeedback(null);
  }

  const saving = operation === 'save';
  return (
    <section
      aria-label="主题"
      className="tw-grid tw-gap-2.5"
    >
      {workflow?.kind === 'edit' ? (
        <ThemeEditor
          key={workflow.theme.id}
          initial={workflow.theme}
          state={state}
          dark={dark}
          increasedContrast={increasedContrast}
          platform={controller.platform}
          saving={saving}
          onCancel={cancel}
          onSave={(theme) => applyTheme(theme, '主题已保存并应用。')}
        />
      ) : workflow?.kind === 'import' ? (
        <div className="tw-grid tw-gap-2.5">
          <h2
            ref={importHeading}
            tabIndex={-1}
            className="!tw-m-0"
          >
            预览导入主题
          </h2>
          <p className="!tw-m-0 tw-font-medium tw-overflow-anywhere">{workflow.theme.name}</p>
          <ThemePreview
            theme={workflow.theme}
            state={state}
            mode={dark ? 'dark' : 'light'}
            increasedContrast={increasedContrast}
          />
          {workflow.collision ? (
            <p className="!tw-m-0">
              {workflow.collision === 'built-in'
                ? '与内置主题标识相同，可以导入为副本。'
                : '已有同一主题，可以替换它或导入为副本。'}
            </p>
          ) : null}
          <div className="tw-flex tw-flex-wrap tw-justify-end tw-gap-2">
            <CalendarButton
              disabled={saving}
              onClick={cancel}
            >
              取消
            </CalendarButton>
            {workflow.collision === 'custom' ? (
              <CalendarButton
                disabled={saving}
                onClick={() => applyTheme(workflow.theme, '主题已替换并应用。')}
              >
                替换并应用
              </CalendarButton>
            ) : null}
            <CalendarButton
              appearance="primary"
              loading={saving}
              onClick={() =>
                applyTheme(
                  workflow.collision ? workflow.copy : workflow.theme,
                  '主题已导入并应用。',
                )
              }
            >
              {workflow.collision ? '另存并应用' : '导入并应用'}
            </CalendarButton>
          </div>
        </div>
      ) : (
        <>
          <h2 className="!tw-m-0">主题</h2>
          <ThemeChoices
            items={builtInThemes}
            selectedId={selected.id}
            label="内置主题"
            disabled={!state.ready || operation !== null || removing !== null}
            onSelect={(selectedId) =>
              void updateLibrary((current) => ({ ...current, selectedId }), '')
            }
          />
          {library.custom.length ? (
            <>
              <h3 className="tw-mb-0 tw-mt-1 tw-text-xs tw-font-semibold">我的主题</h3>
              <ThemeChoices
                items={library.custom}
                selectedId={selected.id}
                label="我的主题"
                disabled={!state.ready || operation !== null || removing !== null}
                onSelect={(selectedId) =>
                  void updateLibrary((current) => ({ ...current, selectedId }), '')
                }
              />
            </>
          ) : null}
          <ThemePreview
            theme={selected}
            mode={dark ? 'dark' : 'light'}
            state={state}
            increasedContrast={increasedContrast}
          />
          {removing ? (
            <div className="tw-grid tw-gap-2">
              <p className="!tw-m-0 tw-overflow-anywhere">
                删除「{removing.name}」？删除后将使用清爽白。
              </p>
              <div className="tw-flex tw-flex-wrap tw-justify-end tw-gap-2">
                <CalendarButton
                  disabled={saving}
                  onClick={() => setRemoving(null)}
                >
                  取消
                </CalendarButton>
                <CalendarButton
                  appearance="danger"
                  loading={saving}
                  onClick={() =>
                    void updateLibrary(
                      (current) => ({
                        selectedId: builtInThemes[0].id,
                        custom: current.custom.filter((theme) => theme.id !== removing.id),
                      }),
                      '主题已删除。',
                    )
                  }
                >
                  删除
                </CalendarButton>
              </div>
            </div>
          ) : (
            <div className="tw-flex tw-flex-wrap tw-gap-2">
              <CalendarButton
                appearance="primary"
                disabled={!state.ready || operation !== null}
                onClick={startEditing}
              >
                {isBuiltInTheme(selected.id) ? '自定义主题' : '编辑主题'}
              </CalendarButton>
              <ThemeFilePicker
                platform={controller.platform}
                accept=".icaltheme,.json,application/json"
                label="导入主题…"
                disabled={!state.ready || operation !== null}
                loading={operation === 'import'}
                onFile={(file) => void importTheme(file)}
              />
              {controller.platform.exportTheme ? (
                <CalendarButton
                  disabled={!state.ready || operation !== null}
                  loading={operation === 'export'}
                  onClick={() => void exportTheme()}
                >
                  导出主题…
                </CalendarButton>
              ) : null}
              {!isBuiltInTheme(selected.id) ? (
                <CalendarButton
                  appearance="text"
                  disabled={operation !== null}
                  onClick={() => {
                    setFeedback(null);
                    setRemoving(selected);
                  }}
                >
                  删除主题…
                </CalendarButton>
              ) : null}
            </div>
          )}
        </>
      )}
      {feedback ? (
        <p
          className={
            '!tw-m-0 tw-overflow-anywhere ' + (feedback.error ? '!tw-text-red' : '!tw-text-green')
          }
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
