/** 应用版本更新不进入历法核心；检查、签名验证和安装由平台实现。 */
export interface AppRelease {
  version: string;
  notes?: string;
}

export interface AppUpdateProgress {
  phase: 'downloading' | 'installing';
  downloaded: number;
  total?: number;
}

export interface AppUpdater {
  check(): Promise<AppRelease | null>;
  /** 宿主先下载并验签，再等待 beforeInstall 保存最新偏好，最后安装并重启。 */
  install(
    version: string,
    onProgress: (progress: AppUpdateProgress) => void,
    beforeInstall: () => Promise<void>,
  ): Promise<void>;
}

export interface AppUpdateSnapshot {
  phase: 'unavailable' | 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error';
  release: AppRelease | null;
  progress: AppUpdateProgress | null;
  error: string | null;
  checkedAt: string | null;
  dismissed: boolean;
}

export const APP_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

function updateMessage(error: unknown, fallback: string) {
  switch (error) {
    case 'UPDATE_NETWORK':
      return '与更新服务器的连接中断或超时，请稍后重试。';
    case 'UPDATE_SERVER':
      return '更新服务器暂未提供所需文件，请稍后重试。';
    case 'UPDATE_MANIFEST':
      return '无法读取适用于此设备的更新清单，请稍后重新检查。';
    case 'UPDATE_SIGNATURE':
      return '更新包未通过签名校验，请重新检查版本并下载。';
    default:
      return fallback;
  }
}

/** 检查与安装互斥；安装必须由用户明确触发。 */
export class AppUpdateController {
  private snapshot: AppUpdateSnapshot;
  private listeners = new Set<() => void>();
  private nextAutomaticCheck = -Infinity;
  private dismissedVersion?: string;
  private disposed = false;

  constructor(
    private updater: AppUpdater | undefined,
    private now: () => Date = () => new Date(),
    private beforeInstall: () => Promise<void> = async () => {},
  ) {
    this.snapshot = {
      phase: updater ? 'idle' : 'unavailable',
      release: null,
      progress: null,
      error: null,
      checkedAt: null,
      dismissed: false,
    };
  }

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(next: Partial<AppUpdateSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  private busy() {
    return ['checking', 'downloading', 'installing'].includes(this.snapshot.phase);
  }

  async check(automatic = false) {
    if (!this.updater || this.disposed || this.busy()) return;
    const time = this.now().getTime();
    if (automatic && time < this.nextAutomaticCheck) return;
    this.nextAutomaticCheck = time + APP_UPDATE_INTERVAL_MS;
    this.patch({ phase: 'checking', error: null, progress: null });
    try {
      const release = await this.updater.check();
      if (this.disposed) return;
      this.patch({
        phase: release ? 'available' : 'idle',
        release,
        checkedAt: this.now().toISOString(),
        dismissed: release?.version === this.dismissedVersion,
      });
    } catch (error) {
      this.patch({ phase: 'error', error: updateMessage(error, '检查新版本失败，请稍后重试。') });
    }
  }

  defer() {
    this.dismissedVersion = this.snapshot.release?.version;
    this.patch({ dismissed: true });
  }

  async install() {
    const release = this.snapshot.release;
    if (!this.updater || !release || this.disposed || this.busy()) return;
    this.patch({ phase: 'downloading', progress: null, error: null });
    let failureMessage = '设置保存失败，请保存后重试。';
    try {
      await this.beforeInstall();
      if (this.disposed) return;
      failureMessage = '更新包下载失败，请重新下载。';
      await this.updater.install(
        release.version,
        (progress) => {
          this.patch({ phase: progress.phase, progress });
        },
        async () => {
          failureMessage = '设置保存失败，请保存后重试。';
          await this.beforeInstall();
          if (this.disposed) throw new Error('页面已退出');
          failureMessage = '更新安装失败，请检查应用所在目录的写入权限后重试。';
          this.patch({ phase: 'installing' });
        },
      );
      // Mac 安装成功后由宿主重启；宿主未立即退出时保留完成提示。
      this.patch({ phase: 'installing' });
    } catch (error) {
      this.patch({ phase: 'error', error: updateMessage(error, failureMessage) });
    }
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}
