// Shows a real A4 page (794 × 1123 px at 96 dpi) shrunk to fit its container.
import { useLayoutEffect, useRef, useState } from "react";

export const PAGE_W = 793.7; // 210 mm
export const PAGE_H = 1122.5; // 297 mm

export default function ScaledPage({ children, maxWidth }) {
  const wrap = useRef(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => {
      const w = Math.min(el.clientWidth, maxWidth || Infinity);
      setScale(w / PAGE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);

  return (
    <div ref={wrap} className="scaled-wrap">
      <div className="scaled-box" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
        <div className="scaled-inner" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
