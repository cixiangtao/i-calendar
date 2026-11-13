import * as ContextMenu from '@radix-ui/react-context-menu';
import { useEffect, useState, type ReactElement } from 'react';

export interface CalendarContextMenuProps {
  children: ReactElement;
  items: readonly { key: string; label: string; onSelect: () => void; disabled?: boolean }[];
}
/** 日期右键/长按菜单与页面共享主题，Esc 只关闭菜单，窗口失焦时收起。 */
export function CalendarContextMenu({ children, items }: CalendarContextMenuProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('blur', close);
    return () => window.removeEventListener('blur', close);
  }, []);
  return (
    <ContextMenu.Root
      open={open}
      onOpenChange={setOpen}
      modal={false}
    >
      <ContextMenu.Trigger
        asChild
        tabIndex={0}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          data-calendar-popup="context-menu"
          collisionPadding={12}
          className="tw-z-50 tw-box-border tw-min-w-[160px] tw-rounded-[10px] tw-bg-surface tw-p-1 tw-font-sans tw-text-[13px] tw-leading-5 tw-text-ink tw-shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)] tw-outline-none"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <ContextMenu.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className="tw-flex tw-min-h-7 tw-cursor-default tw-select-none tw-items-center tw-rounded-md tw-px-3 tw-py-1 tw-font-normal tw-outline-none data-[disabled]:tw-pointer-events-none data-[highlighted]:tw-bg-control-hover data-[disabled]:tw-text-muted coarse:tw-min-h-11"
            >
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
