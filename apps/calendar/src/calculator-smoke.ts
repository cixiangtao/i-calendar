import type { CalendarController } from '@i-calendar/ui';
import { flushSync } from 'react-dom';

const requireResult = (expected: string) => {
  if (!document.querySelector('output')?.textContent?.includes(expected))
    throw new Error(`日期工具结果不符：${expected}`);
};
const fill = (id: string, value: string) => {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`缺少日期工具输入：${id}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('无法模拟日期工具输入');
  flushSync(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const click = (selector: string, text?: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>(selector)].find(
    (element) => !text || element.textContent?.includes(text),
  );
  if (!button) throw new Error(`缺少日期工具操作：${text ?? selector}`);
  flushSync(() => button.click());
};

/** 仅供隔离原生冒烟使用，经真实 WebView 输入与点击验证日期工具。 */
export function verifyDateCalculator(controller: CalendarController) {
  const originalDate = controller.getSnapshot().selected.date;
  try {
    flushSync(() => controller.showCalculator());
    fill('calculator-start', '2024-02-28');
    fill('calculator-end', '2024-03-01');
    requireResult('相隔 2 天');
    click('[role="radio"]', '前后推算');
    fill('calculator-start', '2026-11-17');
    fill('calculator-amount', '100');
    requireResult('2027-02-25');
    click('button', '在月历中查看');
    if (
      controller.getSnapshot().panel !== 'calendar' ||
      controller.getSnapshot().selected.date !== '2027-02-25'
    )
      throw new Error('日期工具未跳转到计算结果');
    flushSync(() => controller.showCalculator());
    click('[role="radio"]', '工作日');
    fill('calculator-start', '2026-02-13');
    fill('calculator-end', '2026-02-14');
    requireResult('1 个工作日');
    fill('calculator-end', '2028-01-03');
    requireResult('无法确定工作日');
    if (
      document.querySelector('output')!.scrollWidth >
      document.querySelector('output')!.clientWidth + 1
    )
      throw new Error('日期工具结果出现横向溢出');
    return true;
  } finally {
    flushSync(() => {
      controller.selectDate(originalDate);
      controller.showCalculator(false);
    });
  }
}
