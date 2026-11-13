import * as ContextMenu from '@radix-ui/react-context-menu';
import { useEffect, useState, type ReactElement } from 'react';

import { cn, popupClasses, popupItemClasses } from './ui-utils.js';

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
          className={cn('tw-min-w-[160px]', popupClasses)}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <ContextMenu.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={popupItemClasses}
            >
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
