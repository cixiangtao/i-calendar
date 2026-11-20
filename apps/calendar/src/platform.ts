import type {
  AppRelease,
  AppUpdateProgress,
  AppUpdater,
  CalendarPlatform,
  SavedCalendarState,
} from '@i-calendar/ui';
import { Channel, isTauri, invoke } from '@tauri-apps/api/core';

import { createDailySignStorage } from './daily-sign-storage.js';
import { browserLocate, nativeLocate } from './location.js';

const STORAGE_KEY = 'i-calendar:state:v1';
// 仅用于只读迁移；新数据始终写入当前名称，旧记录保留。
const LEGACY_STORAGE_KEY = 'shiri-calendar:state:v1';

async function downloadTheme(name: string, content: Uint8Array<ArrayBuffer>) {
  const file = new File([content], name, { type: 'application/zip' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

function nativeAppUpdater(): AppUpdater {
  return {
    async check() {
      const release = await invoke<{ version: string; notes: string | null } | null>(
        'check_app_update',
      );
      return release
        ? ({ version: release.version, notes: release.notes ?? undefined } satisfies AppRelease)
        : null;
    },
    async install(version, onProgress, beforeInstall) {
      const progress = new Channel<AppUpdateProgress>(onProgress);
      await invoke('set_popup_busy', { busy: true });
      try {
        await invoke('download_app_update', { version, progress });
        await beforeInstall();
        await invoke('install_app_update', { version });
      } finally {
        await invoke('set_popup_busy', { busy: false }).catch(() => {});
      }
    },
  };
}

/** 普通浏览器只使用公开数据、本地存储和浏览器系统能力。 */
function browserPlatform(): CalendarPlatform {
  return {
    kind: 'web',
    development: import.meta.env.DEV,
    dailySign: createDailySignStorage(),
    locate: browserLocate,
    async load() {
      const value = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      return value === null ? null : (JSON.parse(value) as unknown);
    },
    async save(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    async fetchHolidayYear(year, signal) {
      const timeout = new AbortController();
      const timer = window.setTimeout(() => timeout.abort(), 12_000);
      const abort = () => timeout.abort();
      signal.addEventListener('abort', abort, { once: true });
      try {
        if (signal.aborted) throw new Error('查询已取消');
        const response = await fetch(
          `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
          { signal: timeout.signal, cache: 'no-store', credentials: 'omit' },
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('数据下载失败');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('数据流不可用');
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          length += item.value.byteLength;
          if (length > 1_000_000) {
            await reader.cancel();
            throw new Error('调休数据超过大小限制');
          }
          chunks.push(item.value);
        }
        const data = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder().decode(data)) as unknown;
      } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
    async openExternal(url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) opened.opener = null;
    },
    async copyText(text) {
      await navigator.clipboard.writeText(text);
    },
    exportTheme: downloadTheme,
  };
}

/** 原生能力通过 Rust 命令或受限插件实现，界面逻辑与 Web 保持相同。 */
export async function createPlatform(): Promise<{
  platform: CalendarPlatform;
  smokeTest: boolean;
}> {
  if (!isTauri()) return { platform: browserPlatform(), smokeTest: false };
  const context = await invoke<{ kind: 'macos' | 'ios'; development: boolean; smokeTest: boolean }>(
    'runtime_context',
  );
  const updatesEnabled =
    context.kind === 'macos' &&
    !context.smokeTest &&
    (await invoke<boolean>('app_update_available').catch(() => false));
  const launchAtLoginAvailable =
    context.kind === 'macos' &&
    !context.smokeTest &&
    (await invoke<boolean>('launch_at_login_available').catch(() => false));
  return {
    smokeTest: context.smokeTest,
    platform: {
      kind: context.kind,
      development: context.development || import.meta.env.DEV,
      dailySign: context.smokeTest ? undefined : createDailySignStorage(),
      ...(!context.smokeTest
        ? {
            async locate(signal: AbortSignal, requestPermission: boolean) {
              await invoke('set_popup_busy', { busy: true });
              try {
                return await nativeLocate(signal, requestPermission);
              } finally {
                await invoke('set_popup_busy', { busy: false }).catch(() => {});
              }
            },
          }
        : {}),
      ...(context.kind === 'macos' && !context.smokeTest
        ? { openLocationSettings: () => invoke<void>('open_sunlight_settings') }
        : {}),
      load: () => invoke<unknown>('load_state'),
      save: (state: SavedCalendarState) => invoke<void>('save_state', { state }),
      async fetchHolidayYear(year, signal) {
        if (signal.aborted) throw new Error('查询已取消');
        const result = await invoke<unknown>('fetch_holiday_year', { year });
        if (signal.aborted) throw new Error('查询已取消');
        return result;
      },
      async openExternal(url) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(url);
      },
      async copyText(text) {
        const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
        await writeText(text);
      },
      exportTheme:
        context.kind === 'macos'
          ? async (name, content) => {
              await invoke('set_popup_busy', { busy: true });
              try {
                return await invoke<boolean>('export_theme', {
                  name,
                  content: Array.from(content),
                });
              } finally {
                await invoke('set_popup_busy', { busy: false }).catch(() => {});
              }
            }
          : downloadTheme,
      setInteractionBusy: (busy) => invoke<void>('set_popup_busy', { busy }),
      ...(updatesEnabled ? { appUpdater: nativeAppUpdater() } : {}),
      ...(launchAtLoginAvailable
        ? {
            launchAtLogin: {
              get: () => invoke<boolean>('get_launch_at_login'),
              set: (enabled: boolean) => invoke<boolean>('set_launch_at_login', { enabled }),
            },
          }
        : {}),
      ...(context.kind === 'macos'
        ? {
            close: () => invoke<void>('close_calendar'),
            quit: () => invoke<void>('quit_calendar'),
            setPopupHeight: (height: number) => invoke<void>('resize_popup', { height }),
          }
        : {}),
    },
  };
}
