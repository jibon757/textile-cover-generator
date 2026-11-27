// "Illustration" section: pick a picture for the cover.
//  1) Approved pictures for this subject (made by AI for other students, saved after their download)
//  2) Common pictures (added by the site owner)
//  3) ✨ AI Generate: a few trial pictures; nothing is saved until you download your cover
//  4) Your own image from this device (private, never shared)
import { useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { readImageFile } from "../imageTools.js";

const TRIALS_PER_ROUND = 3;

const words = (s) =>
  String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9\u0980-\u09ff]+/)
    .filter((w) => w.length > 2 && !["lab", "and", "the", "for", "report"].includes(w));

function Thumb({ src, label, on, onClick }) {
  return (
    <button type="button" className={"img-tile" + (on ? " on" : "")} onClick={onClick} title={label}>
      <img src={src} alt={label} loading="lazy" />
      {on && <span className="img-check">✓</span>}
    </button>
  );
}

export default function ImageChooser({ d, up, notify, confirm, library, reloadLibrary, trials, setTrials }) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(null); // null | { n, of }
  const [showAll, setShowAll] = useState(false);
  const fileInput = useRef(null);

  const subjectKeyWords = useMemo(() => words(d.subjectName + " " + d.subjectCode), [d.subjectName, d.subjectCode]);
  const { forSubject, others } = useMemo(() => {
    const all = library?.approved || [];
    const score = (img) => {
      const w = words(img.subjectName + " " + img.subjectCode);
      return w.filter((x) => subjectKeyWords.includes(x)).length;
    };
    const scored = all.map((img) => ({ img, s: subjectKeyWords.length ? score(img) : 0 }));
    return {
      forSubject: scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.img),
      others: scored.filter((x) => x.s === 0).map((x) => x.img),
    };
  }, [library, subjectKeyWords]);

  const pick = (url, trialToken = null) => up({ illustration: url, illustrationTrial: trialToken });

  async function generate() {
    if (!d.subjectName.trim()) return notify("error", "Write the subject name first (Report & Subject), so the picture matches it.");
    const made = [];
    try {
      for (let i = 1; i <= TRIALS_PER_ROUND; i++) {
        setBusy({ n: i, of: TRIALS_PER_ROUND });
        const r = await api("/api/ai/generate", { method: "POST", body: { subjectName: d.subjectName, subjectCode: d.subjectCode, idea } });
        made.push({ id: r.token.slice(-12), image: r.image, token: r.token });
        setTrials((t) => [...t, made[made.length - 1]]);
      }
      notify("success", "Pictures ready. Tap one to try it on your cover.");
    } catch (err) {
      notify("error", err.message);
    } finally {
      setBusy(null);
    }
  }

  async function discardTrials() {
    if (!(await confirm("Discard all AI trial pictures? (They are not saved anywhere.)"))) return;
    if (d.illustrationTrial) pick("", null);
    setTrials([]);
  }

  const usingTrial = !!d.illustrationTrial;
  const usingOwn = d.illustration?.startsWith("data:") && !usingTrial;

  return (
    <div className="img-chooser">
      <div className="logo-row">
        <div className="illus-thumb">{d.illustration ? <img src={d.illustration} alt="Selected illustration" /> : <span>No image</span>}</div>
        <div className="btn-col">
          <p className="hint">
            {usingTrial
              ? "✨ AI trial picture. It is added to the library for everyone only after you download your cover PDF."
              : usingOwn
                ? "🔒 Your own image. It stays private (not shared with anyone)."
                : d.illustration
                  ? "Picture from the library."
                  : "No picture on the cover."}
          </p>
          {d.illustration && (
            <button type="button" className="btn-link danger" onClick={() => pick("", null)}>
              Remove image
            </button>
          )}
        </div>
      </div>

      <h4 className="img-h">For this subject</h4>
      {library === null && <p className="hint">Loading pictures…</p>}
      {library && forSubject.length === 0 && (
        <p className="hint">{d.subjectName.trim() ? "No saved picture for this subject yet. Try ✨ AI Generate below." : "Write the subject name to see matching pictures."}</p>
      )}
      {forSubject.length > 0 && (
        <div className="img-grid">
          {forSubject.slice(0, 12).map((img) => (
            <Thumb key={img.id} src={img.url} label={img.subjectName} on={d.illustration === img.url} onClick={() => pick(img.url)} />
          ))}
        </div>
      )}

      <h4 className="img-h">Common pictures</h4>
      {library && (
        <div className="img-grid">
          {library.common.map((img) => (
            <Thumb key={img.id} src={img.url} label={img.title} on={d.illustration === img.url} onClick={() => pick(img.url)} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <>
          <button type="button" className="btn-link" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Hide other subjects' pictures" : `Show other subjects' pictures (${others.length})`}
          </button>
          {showAll && (
            <div className="img-grid">
              {others.map((img) => (
                <Thumb key={img.id} src={img.url} label={img.subjectName} on={d.illustration === img.url} onClick={() => pick(img.url)} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="ai-box">
        <h4 className="img-h">✨ AI Generate</h4>
        <p className="hint">Makes {TRIALS_PER_ROUND} trial pictures for "{d.subjectName.trim() || "your subject"}". Trials are not saved. Up to 9 per day.</p>
        <input placeholder="Describe the picture (optional), e.g. dyeing machine with blue fabric" value={idea} maxLength={200} onChange={(e) => setIdea(e.target.value)} />
        <button type="button" className="btn-main full" onClick={generate} disabled={!!busy}>
          {busy ? (
            <>
              <span className="spinner" /> Making picture {busy.n} of {busy.of}…
            </>
          ) : (
            "✨ AI Generate pictures"
          )}
        </button>
        {busy && (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${((busy.n - 1) / busy.of) * 100 + 10}%` }} />
          </div>
        )}
        {trials.length > 0 && (
          <>
            <div className="img-grid">
              {trials.map((t) => (
                <Thumb key={t.id} src={t.image} label="AI trial" on={d.illustration === t.image} onClick={() => pick(t.image, t.token)} />
              ))}
            </div>
            <button type="button" className="btn-link danger" onClick={discardTrials}>
              Discard trial pictures
            </button>
          </>
        )}
      </div>

      <div className="own-box">
        <button type="button" className="btn-soft" onClick={() => fileInput.current.click()}>
          📁 Use my own image (private)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const file = e.target.files[0];
            e.target.value = "";
            if (!file) return;
            try {
              pick(await readImageFile(file, 1600), null);
              notify("success", "Image added. It stays on your device only.");
            } catch (err) {
              notify("error", err.message);
            }
          }}
        />
        {library?.error && (
          <p className="hint error-text">
            {library.error}{" "}
            <button type="button" className="btn-link" onClick={reloadLibrary}>
              Retry
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
