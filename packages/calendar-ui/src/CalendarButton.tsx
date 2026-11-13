import Button, { type ButtonProps } from 'antd/es/button';
import { useEffect, useState, type Ref } from 'react';

import './CalendarButton.css';

export type CalendarButtonProps = Omit<
  ButtonProps,
  'type' | 'color' | 'variant' | 'styles' | 'classNames' | 'href' | 'target' | 'loading'
> & {
  appearance?: 'neutral' | 'text' | 'icon' | 'toolbar' | 'accent' | 'choice';
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** 统一按钮状态；只有鼠标触发悬停，触摸操作不会留下悬停底色。 */
export function CalendarButton({
  appearance = 'neutral',
  className,
  style,
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
    const clearHover = () => setHovered(false);
    window.addEventListener('blur', clearHover);
    return () => window.removeEventListener('blur', clearHover);
  }, [hovered]);
  return (
    <Button
      {...props}
      type="text"
      disabled={disabled}
      loading={loading}
      aria-busy={loading || undefined}
      aria-label={
        props['aria-label'] ??
        (loading && typeof props.children === 'string' ? props.children : undefined)
      }
      classNames={{ content: 'calendar-button-content' }}
      data-appearance={appearance}
      data-hovered={hovered && !disabled && !loading ? 'true' : undefined}
      className={`calendar-button ${className ?? ''}`}
      style={{
        ...style,
        background: 'transparent',
        borderColor: 'transparent',
        boxShadow: 'none',
        color: 'var(--button-ink)',
      }}
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
    />
  );
}
