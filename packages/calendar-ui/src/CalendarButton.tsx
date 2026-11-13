import { useEffect, useState, type ComponentPropsWithRef, type ReactNode } from 'react';

import { cn } from './ui-utils.js';

export interface CalendarButtonProps extends ComponentPropsWithRef<'button'> {
  appearance?: 'neutral' | 'text' | 'icon' | 'toolbar' | 'accent' | 'choice';
  icon?: ReactNode;
  loading?: boolean;
}

/** 原生按钮保留表单和键盘语义，加载保留标签占位；悬停只响应鼠标。 */
export function CalendarButton({
  appearance = 'neutral',
  type = 'button',
  className,
  children,
  icon,
  disabled,
  loading = false,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  ...props
}: CalendarButtonProps) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered) return;
    const clear = () => setHovered(false);
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, [hovered]);
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={
        props['aria-label'] ?? (loading && typeof children === 'string' ? children : undefined)
      }
      data-appearance={appearance}
      data-hovered={hovered && !disabled && !loading ? 'true' : undefined}
      className={cn(
        'calendar-button tw-relative tw-isolate tw-inline-flex tw-h-[var(--form-height)] tw-shrink-0 tw-items-center tw-justify-center tw-gap-2 tw-whitespace-nowrap tw-rounded-[var(--form-radius)] tw-border-0 tw-bg-transparent tw-px-[var(--form-inset)] tw-py-0 tw-font-sans tw-text-[length:var(--form-font-size)] tw-font-medium tw-leading-[var(--form-line-height)] tw-shadow-none tw-outline-none disabled:tw-cursor-default disabled:tw-text-muted disabled:tw-opacity-50',
        "before:tw-pointer-events-none before:tw-absolute before:tw-left-1/2 before:tw-top-1/2 before:tw-z-[-1] before:tw-h-[var(--form-height)] before:tw-w-[var(--button-width,calc(100%+2px))] before:-tw-translate-x-1/2 before:-tw-translate-y-1/2 before:tw-rounded-[inherit] before:tw-border before:tw-border-solid before:tw-transition-colors before:tw-duration-[130ms] before:tw-content-['']",
        'focus-visible:before:tw-outline focus-visible:before:tw-outline-1 focus-visible:before:tw-outline-offset-2 focus-visible:before:tw-outline-secondary enabled:active:before:tw-bg-control-active data-[hovered=true]:before:tw-bg-control-hover',
        appearance !== 'choice' &&
          "coarse:after:tw-absolute coarse:after:tw-left-1/2 coarse:after:tw-top-1/2 coarse:after:tw-h-11 coarse:after:tw-w-[max(100%,44px)] coarse:after:-tw-translate-x-1/2 coarse:after:-tw-translate-y-1/2 coarse:after:tw-content-['']",
        (appearance === 'neutral' || appearance === 'toolbar') &&
          'tw-text-ink before:tw-border-transparent before:tw-bg-control',
        appearance === 'text' &&
          'tw-text-action before:tw-border-transparent before:tw-bg-transparent',
        appearance === 'icon' &&
          'tw-w-[var(--form-height)] tw-p-0 tw-text-secondary before:tw-w-[var(--form-height)] before:tw-border-transparent before:tw-bg-transparent data-[hovered=true]:tw-text-ink',
        appearance === 'toolbar' &&
          'tw-w-[var(--form-height)] tw-p-0 before:tw-w-[var(--form-height)]',
        appearance === 'accent' &&
          'tw-min-w-11 tw-text-action before:tw-w-11 before:tw-border-transparent before:tw-bg-action-soft',
        appearance === 'choice' &&
          'tw-h-auto tw-flex-col tw-text-ink before:tw-h-[calc(100%+2px)] before:tw-border-line before:tw-bg-surface aria-pressed:before:tw-border-action aria-pressed:before:tw-shadow-[inset_0_0_0_1px_var(--blue)]',
        loading && 'tw-cursor-progress',
        className,
      )}
      onPointerEnter={(event) => {
        setHovered(event.pointerType === 'mouse');
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        setHovered(event.pointerType === 'mouse');
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        setHovered(false);
        onPointerLeave?.(event);
      }}
      onPointerDown={(event) => {
        setHovered(event.pointerType === 'mouse');
        onPointerDown?.(event);
      }}
    >
      <span className={cn('calendar-button-content tw-contents', loading && 'tw-invisible')}>
        {icon}
        {children}
      </span>
      {loading ? (
        <span
          aria-hidden="true"
          className="tw-absolute tw-left-1/2 tw-top-1/2 -tw-translate-x-1/2 -tw-translate-y-1/2"
        >
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}

/** 加载图形只提供视觉反馈，操作名称由控件提供。 */
export function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="tw-block tw-h-[13px] tw-w-[13px] tw-animate-spin tw-fill-none tw-stroke-current"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        opacity=".25"
        strokeWidth="2"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
