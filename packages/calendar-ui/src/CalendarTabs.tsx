import * as Tabs from '@radix-ui/react-tabs';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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
  const [pointerFocus, setPointerFocus] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [indicatorLeft, setIndicatorLeft] = useState<number>();
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const tabs = list.querySelectorAll<HTMLElement>('[role="tab"]');
    const active = tabs[items.findIndex((item) => item.key === value)];
    const update = () => {
      const activeRect = active?.getBoundingClientRect();
      setIndicatorLeft(
        activeRect
          ? activeRect.left -
              list.getBoundingClientRect().left +
              list.scrollLeft +
              (activeRect.width - 20) / 2
          : undefined,
      );
    };
    update();
    // 标签数量、字重或容器宽度变化后，仍让同一条下划线对齐当前文字中心。
    const observer = new ResizeObserver(update);
    observer.observe(list);
    for (const tab of tabs) observer.observe(tab);
    return () => observer.disconnect();
  }, [value, items]);
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
        ref={listRef}
        aria-label="设置分类"
        className="tw-relative tw-mb-2 tw-flex tw-shrink-0 tw-gap-3 tw-border-0 tw-border-b tw-border-solid tw-border-line"
        onPointerDownCapture={() => setPointerFocus(true)}
        onKeyDownCapture={() => setPointerFocus(false)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPointerFocus(false);
        }}
      >
        {items.map((item) => (
          <Tabs.Trigger
            key={item.key}
            value={item.key}
            className={cn(
              'tw-relative tw-inline-flex tw-min-h-[34px] tw-min-w-11 tw-select-none tw-items-center tw-justify-center tw-rounded-[3px] tw-border-0 tw-bg-transparent tw-px-0.5 tw-py-1.5 tw-font-sans tw-text-[13px] tw-font-normal tw-leading-5 tw-text-secondary tw-outline-none tw-transition-colors tw-duration-[var(--motion-feedback)] tw-ease-[var(--motion-ease)] data-[state=active]:tw-font-semibold data-[state=active]:tw-text-ink coarse:tw-min-h-11 data-[state=inactive]:fine:hover:tw-text-ink',
              pointerFocus ? 'focus-visible:tw-outline-none' : controlFocus,
            )}
          >
            {item.label}
          </Tabs.Trigger>
        ))}
        {indicatorLeft !== undefined ? (
          <span
            aria-hidden="true"
            className="calendar-tab-indicator tw-pointer-events-none tw-absolute -tw-bottom-px tw-left-0 tw-h-0.5 tw-w-5 tw-rounded-[2px] tw-bg-ink tw-transition-transform tw-duration-[var(--motion-state)] tw-ease-[var(--motion-ease)]"
            style={{ transform: `translateX(${indicatorLeft}px)` }}
          />
        ) : null}
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
