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

const AUTOMATIC_INTERVAL = 24 * 60 * 60 * 1000;

/** 检查与安装互斥，自动检查每日最多一次；安装必须由用户明确触发。 */
export class AppUpdateController {
  private snapshot: AppUpdateSnapshot;
  private listeners = new Set<() => void>();
  private lastAutomaticCheck = -Infinity;
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
    if (automatic && time - this.lastAutomaticCheck < AUTOMATIC_INTERVAL) return;
    // 失败也计入自动频率，离线时不反复请求；手动检查不受此限制。
    this.lastAutomaticCheck = time;
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
    } catch {
      this.patch({ phase: 'error', error: '检查失败，仍可正常使用日历，请稍后重试。' });
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
    try {
      await this.beforeInstall();
      if (this.disposed) return;
      await this.updater.install(
        release.version,
        (progress) => {
          this.patch({ phase: progress.phase, progress });
        },
        async () => {
          await this.beforeInstall();
          if (this.disposed) throw new Error('页面已退出');
          this.patch({ phase: 'installing' });
        },
      );
      // Mac 安装成功后由宿主重启；宿主未立即退出时保留完成提示。
      this.patch({ phase: 'installing' });
    } catch {
      this.patch({
        phase: 'error',
        error: '更新未完成。请确认设置已保存、网络与安装权限正常，再重试。',
      });
    }
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}
