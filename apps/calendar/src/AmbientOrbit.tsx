import { useEffect, useRef } from 'react';

/** 官网装饰光轨；绘制只读共享主题，不参与历法计算或命中测试。 */
export function AmbientOrbit({ enabled, date }: { enabled: boolean; date: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const targetPhase = useRef(0);
  const elapsed = useRef(0);
  const position = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  useEffect(() => {
    // 日期仅作为视觉相位输入，不表达天体位置或另建历法规则。
    targetPhase.current = (Number(date.slice(-2)) / 31) * Math.PI * 2;
  }, [date]);

  useEffect(() => {
    const element = canvas.current;
    const host = element?.parentElement;
    const context = element?.getContext('2d');
    if (!element || !host || !context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let width = 0;
    let height = 0;
    let inView = true;
    let last = 0;
    let colors = ['#3269d9', '#8b4fc5', '#007f49'];
    const pointer = position.current;
    const canAnimate = () => enabled && !reduced.matches && inView && !document.hidden;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const cx = width * 0.72 + pointer.x * 34;
      const cy = height * 0.24 + pointer.y * 22;
      const radius = Math.min(width * 0.55, 650);
      // 两片主题光晕提供空间深度，中心留白让文字与网格保持清楚。
      for (const [x, y, color] of [
        [width * 0.12, height * 0.44, colors[0]],
        [cx, cy, colors[1]],
      ] as const) {
        const light = context.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(0, color!);
        light.addColorStop(1, 'transparent');
        context.globalAlpha = 0.24;
        context.fillStyle = light;
        context.fillRect(0, 0, width, height);
      }
      context.save();
      context.translate(cx, cy);
      context.rotate(-0.32 + pointer.x * 0.035);
      for (let ring = 0; ring < 3; ring++) {
        const rx = radius * (0.68 + ring * 0.25);
        const ry = rx * 0.46;
        context.globalAlpha = 0.2 - ring * 0.045;
        context.strokeStyle = colors[ring]!;
        context.lineWidth = 1;
        context.beginPath();
        context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        context.stroke();
        const angle = elapsed.current * (0.055 + ring * 0.008) + phase.current + ring * 2;
        context.globalAlpha = 0.8;
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(0, 0, rx, ry, 0, angle - 0.22, angle);
        context.stroke();
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        context.shadowBlur = 16;
        context.shadowColor = colors[ring]!;
        context.fillStyle = colors[ring]!;
        context.beginPath();
        context.arc(x, y, ring === 0 ? 4 : 2.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
      context.restore();
      context.globalAlpha = 1;
    };
    const tick = (now: number) => {
      if (!canAnimate()) {
        frame = 0;
        return;
      }
      if (now - last >= 1000 / 30) {
        elapsed.current += Math.min((now - last) / 1000, 0.05);
        last = now;
        pointer.x += (pointer.targetX - pointer.x) * 0.06;
        pointer.y += (pointer.targetY - pointer.y) * 0.06;
        phase.current += (targetPhase.current - phase.current) * 0.035;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!canAnimate()) phase.current = targetPhase.current;
      draw();
      if (canAnimate()) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * scale);
      element.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      sync();
    };
    const themeChanged = () => {
      const theme = getComputedStyle(document.documentElement);
      colors = ['--blue', '--purple', '--green'].map((name) => theme.getPropertyValue(name).trim());
      sync();
    };
    const move = (event: PointerEvent) => {
      if (!canAnimate() || event.pointerType === 'touch') return;
      const rect = host.getBoundingClientRect();
      pointer.targetX = (event.clientX - rect.left) / rect.width - 0.5;
      pointer.targetY = (event.clientY - rect.top) / rect.height - 0.5;
    };
    const leave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };
    const size = new ResizeObserver(resize);
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry!.isIntersecting;
      sync();
    });
    const theme = new MutationObserver(themeChanged);
    size.observe(host);
    visibility.observe(host);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme'],
    });
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    resize();
    themeChanged();
    return () => {
      cancelAnimationFrame(frame);
      size.disconnect();
      visibility.disconnect();
      theme.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="tw-pointer-events-none tw-absolute tw-inset-0 tw-h-full tw-w-full"
    />
  );
}
