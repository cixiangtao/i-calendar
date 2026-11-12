import Select from 'antd/es/select';
import { useEffect, useState, type ReactNode } from 'react';

import './CalendarSelect.css';

function renderOption(label: ReactNode, selected: boolean) {
  return (
    <span className="calendar-select-option">
      <span>{label}</span>
      {selected ? (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="m3 8 3 3 7-7" />
        </svg>
      ) : null}
    </span>
  );
}

/** 单选项保留字符串或数字值，标签使用纯文本。 */
export interface CalendarSelectOption<Value extends string | number> {
  value: Value;
  label: string;
  disabled?: boolean;
}

/** 受控单选接口；不向业务调用方暴露底层组件样式与多选配置。 */
export interface CalendarSelectProps<Value extends string | number> {
  id?: string;
  /** 为控件提供可访问名称，设置表单中仍可使用关联 label。 */
  label: string;
  value: Value;
  options: readonly CalendarSelectOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  /** 弹层至少与控件等宽；窄年月控件使用更易阅读的列表宽度。 */
  popupWidth?: number;
  disabled?: boolean;
}

/** 三端共用的单选下拉；统一主题与键盘行为，Esc 优先关闭列表。 */
export function CalendarSelect<Value extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  className = '',
  popupWidth = 128,
  disabled = false,
}: CalendarSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('blur', close);
    return () => window.removeEventListener('blur', close);
  }, []);
  return (
    <span className={`calendar-select ${className}`}>
      <Select<Value, CalendarSelectOption<Value>>
        id={id}
        aria-label={label}
        value={value}
        options={[...options]}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onChange={onChange}
        showSearch={false}
        variant="borderless"
        virtual={false}
        listHeight={240}
        popupMatchSelectWidth={popupWidth}
        classNames={{ root: 'calendar-select-field', popup: { root: 'calendar-select-popup' } }}
        suffix={
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        }
        optionRender={(option) => renderOption(option.label, option.value === value)}
        onInputKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
    </span>
  );
}
