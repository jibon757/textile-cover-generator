// Draws the subject illustration so it melts into the page:
//  - blend (multiply): white pixels of the picture become invisible on the page
//  - feather: the edges fade out softly, so no hard rectangle is ever visible
export function featherMask(feather, shape) {
  if (!feather) return "none";
  const f = Math.min(100, Math.max(0, feather));
  if (shape === "soft-rect") {
    const p = (f / 100) * 22; // % of width/height that fades
    const h = `linear-gradient(to right, transparent 0%, #000 ${p}%, #000 ${100 - p}%, transparent 100%)`;
    const v = `linear-gradient(to bottom, transparent 0%, #000 ${p}%, #000 ${100 - p}%, transparent 100%)`;
    return `${h}, ${v}`;
  }
  // oval: solid centre, soft fade toward the edges
  const solid = 70 - f * 0.45; // 70% -> 25%
  return `radial-gradient(ellipse 50% 50% at 50% 50%, #000 ${solid}%, transparent 100%)`;
}

export default function Illustration({ src, feather = 0, shape = "oval", blend = true, style = {}, className = "" }) {
  if (!src) return null;
  const mask = featherMask(feather, shape);
  const composite = shape === "soft-rect" && feather ? "intersect" : undefined;
  return (
    <div
      className={"illus " + className}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", ...style }}
    >
      <img
        src={src}
        alt="Subject illustration"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          mixBlendMode: blend ? "multiply" : "normal",
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskComposite: composite ? "source-in" : undefined,
          maskComposite: composite,
        }}
      />
    </div>
  );
}
