// <Fit> shrinks its text until it fits inside its box, so long college names,
// subject names or teacher names never overflow or overlap other parts of the page.
import { useLayoutEffect, useRef, useState } from "react";

export default function Fit({ max = 24, min = 9, children, className = "", style = {}, deps = [] }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);
  const [fontsReady, setFontsReady] = useState(0);

  // Web fonts change text width, so measure again once they finish loading.
  useLayoutEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = max;
    el.style.fontSize = s + "pt";
    // Step down 0.5pt at a time until nothing spills out of the box.
    while (s > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      s -= 0.5;
      el.style.fontSize = s + "pt";
    }
    setSize(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, min, fontsReady, ...deps]);

  return (
    <div ref={ref} className={"fit " + className} style={{ ...style, fontSize: size + "pt", overflow: "hidden" }}>
      {children}
    </div>
  );
}
