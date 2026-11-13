/** 登录启动由 Mac 系统管理，不作为跨平台日历偏好保存。 */
export interface LaunchAtLogin {
  get(): Promise<boolean>;
  /** 修改注册后重新读取状态，返回系统实际保存的结果。 */
  set(enabled: boolean): Promise<boolean>;
}

interface LaunchAtLoginSnapshot {
  phase: 'unavailable' | 'idle' | 'checking' | 'updating';
  enabled: boolean | null;
  error: string | null;
}

/** 以系统读回结果展示开关，读写互斥；失败时重新查询，不显示虚假的成功状态。 */
export class LaunchAtLoginController {
  private snapshot: LaunchAtLoginSnapshot;
  private listeners = new Set<() => void>();
  private disposed = false;

  constructor(private platform: LaunchAtLogin | undefined) {
    this.snapshot = { phase: platform ? 'idle' : 'unavailable', enabled: null, error: null };
  }

  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private patch(next: Partial<LaunchAtLoginSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  private busy() {
    return this.snapshot.phase === 'checking' || this.snapshot.phase === 'updating';
  }

  async refresh() {
    if (!this.platform || this.disposed || this.busy()) return;
    this.patch({ phase: 'checking', error: null });
    try {
      const enabled = await this.platform.get();
      this.patch({ phase: 'idle', enabled });
    } catch {
      this.patch({ phase: 'idle', enabled: null, error: '无法读取开机自启状态，请重试。' });
    }
  }

  async set(enabled: boolean) {
    if (!this.platform || this.disposed || this.busy() || this.snapshot.enabled === null) return;
    this.patch({ phase: 'updating', error: null });
    try {
      const applied = await this.platform.set(enabled);
      this.patch({
        phase: 'idle',
        enabled: applied,
        error: applied === enabled ? null : '系统未应用开机自启设置，请重试。',
      });
    } catch {
      let actual: boolean | null = null;
      try {
        actual = await this.platform.get();
      } catch {
        /* 未知状态不显示为已关闭。 */
      }
      this.patch({ phase: 'idle', enabled: actual, error: '开机自启设置未完成，请重试。' });
    }
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
}
