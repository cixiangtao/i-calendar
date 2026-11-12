import Input, { type InputProps } from 'antd/es/input';

type CalendarInputProps = Pick<
  InputProps,
  | 'id'
  | 'value'
  | 'onChange'
  | 'placeholder'
  | 'maxLength'
  | 'disabled'
  | 'status'
  | 'aria-label'
  | 'aria-invalid'
  | 'aria-describedby'
  | 'onFocus'
  | 'onBlur'
  | 'autoComplete'
  | 'name'
>;

/** 统一纯文本输入的可见外观与透明触控区域，保留原生输入及无障碍属性。 */
export function CalendarInput({ disabled, status, ...props }: CalendarInputProps) {
  return (
    <span
      className="calendar-input"
      data-disabled={disabled || undefined}
      data-status={status}
    >
      <Input
        {...props}
        disabled={disabled}
        status={status}
        className="calendar-input-field"
      />
    </span>
  );
}
