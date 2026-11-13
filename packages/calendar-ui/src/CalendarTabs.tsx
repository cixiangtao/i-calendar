import * as Tabs from '@radix-ui/react-tabs';
import { useState, type ReactNode } from 'react';

import { cn, controlFocus } from './ui-utils.js';

export interface CalendarTabsProps {
  defaultValue: string;
  items: readonly { key: string; label: string; children: ReactNode }[];
  className?: string;
}
/** 标签页首次访问才挂载，访问后保留草稿；隐藏页从布局及无障碍树中移除。 */
export function CalendarTabs({ defaultValue, items, className }: CalendarTabsProps) {
  const [value, setValue] = useState(defaultValue);
  const [visited, setVisited] = useState(() => new Set([defaultValue]));
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => {
        setValue(next);
        setVisited((old) => new Set([...old, next]));
      }}
      className={cn(
        'settings-tabs tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-font-sans tw-text-[13px] tw-leading-5',
        className,
      )}
    >
      <Tabs.List
        aria-label="设置分类"
        className="tw-mb-2 tw-flex tw-shrink-0 tw-gap-3 tw-border-0 tw-border-b tw-border-solid tw-border-line"
      >
        {items.map((item) => (
          <Tabs.Trigger
            key={item.key}
            value={item.key}
            className={cn(
              "tw-relative tw-inline-flex tw-min-h-[34px] tw-min-w-11 tw-items-center tw-justify-center tw-rounded-[3px] tw-border-0 tw-bg-transparent tw-px-0.5 tw-py-1.5 tw-font-sans tw-text-[13px] tw-font-normal tw-leading-5 tw-text-secondary tw-outline-none tw-transition-colors tw-duration-[var(--motion-feedback)] tw-ease-[var(--motion-ease)] after:tw-absolute after:-tw-bottom-px after:tw-left-1/2 after:tw-h-0.5 after:tw-w-5 after:-tw-translate-x-1/2 after:tw-scale-x-50 after:tw-rounded-[2px] after:tw-opacity-0 after:tw-transition-[opacity,transform] after:tw-duration-[var(--motion-state)] after:tw-ease-[var(--motion-ease)] after:tw-content-[''] data-[state=active]:tw-font-semibold data-[state=active]:tw-text-ink data-[state=active]:after:tw-scale-x-100 data-[state=active]:after:tw-bg-ink data-[state=active]:after:tw-opacity-100 coarse:tw-min-h-11 fine:hover:tw-text-ink",
              controlFocus,
            )}
          >
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {items.map((item) =>
        visited.has(item.key) ? (
          <Tabs.Content
            key={item.key}
            value={item.key}
            forceMount
            hidden={value !== item.key}
            className="tw-min-h-0 tw-flex-1 tw-overflow-hidden tw-outline-none data-[state=inactive]:tw-hidden"
          >
            {/* 动画放在内层，避免 Radix 首次挂载时的 0s 保护覆盖标签切换反馈。 */}
            <div className="settings-tab-content tw-h-full tw-min-h-0">{item.children}</div>
          </Tabs.Content>
        ) : null,
      )}
    </Tabs.Root>
  );
}
