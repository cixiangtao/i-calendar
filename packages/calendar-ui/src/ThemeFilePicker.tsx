import { useEffect, useRef } from 'react';

import { CalendarButton } from './CalendarButton.js';
import type { CalendarPlatform } from './platform.js';

/** 通过系统文件选择器读取单个文件，打开时让 macOS 弹窗保持可见。 */
export function ThemeFilePicker({
  platform,
  accept,
  label,
  disabled,
  loading,
  onFile,
}: {
  platform: CalendarPlatform;
  accept: string;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const picking = useRef(false);
  const busy = platform.setInteractionBusy;
  useEffect(() => {
    const element = input.current;
    const release = () => {
      if (!picking.current) return;
      picking.current = false;
      void busy?.(false);
    };
    element?.addEventListener('cancel', release);
    element?.addEventListener('change', release);
    return () => {
      element?.removeEventListener('cancel', release);
      element?.removeEventListener('change', release);
      release();
    };
  }, [busy]);
  return (
    <>
      <input
        ref={input}
        type="file"
        className="tw-hidden"
        accept={accept}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onFile(file);
        }}
      />
      <CalendarButton
        disabled={disabled}
        loading={loading}
        onClick={() => {
          picking.current = true;
          void busy?.(true);
          input.current?.click();
        }}
      >
        {label}
      </CalendarButton>
    </>
  );
}
