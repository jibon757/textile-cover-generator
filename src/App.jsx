// Phase 3: Cover + Index generator with live A4 preview.
import { useEffect, useRef, useState, useCallback } from "react";
import { emptyCover, emptyIndex } from "./data.js";
import { COVER_TEMPLATES } from "./templates/covers.jsx";
import { INDEX_TEMPLATES } from "./templates/indexes.jsx";
import { CoverEditor, IndexEditor } from "./components/Editors.jsx";
import ScaledPage from "./components/ScaledPage.jsx";
import { auth, signInAnonymously } from "./firebase.js";

const DRAFT_KEY = "tcg.draft.v1";

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const base = emptyCover();
    return {
      cover: { ...base, ...d.cover, student: { ...base.student, ...d.cover?.student }, teacher: { ...base.teacher, ...d.cover?.teacher } },
      index: d.index?.rows?.length ? d.index : emptyIndex(),
      coverTpl: d.coverTpl || COVER_TEMPLATES[0].id,
      indexTpl: d.indexTpl || INDEX_TEMPLATES[0].id,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const draft = useRef(loadDraft()).current;
  const [cover, setCover] = useState(draft?.cover || emptyCover());
  const [index, setIndex] = useState(draft?.index || emptyIndex());
  const [coverTpl, setCoverTpl] = useState(draft?.coverTpl || COVER_TEMPLATES[0].id);
  const [indexTpl, setIndexTpl] = useState(draft?.indexTpl || INDEX_TEMPLATES[0].id);
  const [tab, setTab] = useState("cover"); // "cover" | "index"
  const [mobileView, setMobileView] = useState("edit"); // "edit" | "preview" (phones only)
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [printWhat, setPrintWhat] = useState(null); // null | "cover" | "index" | "both"
  const [saveState, setSaveState] = useState("saved");

  const notify = useCallback((type, text) => {
    setToast({ type, text, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const confirm = useCallback((text) => new Promise((resolve) => setDialog({ text, resolve })), []);

  // Anonymous visitor ID (used later for fair-use limits; no personal data).
  useEffect(() => {
    if (!auth.currentUser) signInAnonymously(auth).catch(() => {});
  }, []);

  // Auto-save the draft on this device only.
  useEffect(() => {
    setSaveState("saving");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ cover, index, coverTpl, indexTpl }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
        notify("error", "This browser's storage is full, so your draft isn't being saved. Try a smaller image.");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cover, index, coverTpl, indexTpl, notify]);

  // Print: render the chosen pages, then open the print dialog.
  useEffect(() => {
    if (!printWhat) return;
    const t = setTimeout(() => {
      window.print();
      setPrintWhat(null);
    }, 300);
    return () => clearTimeout(t);
  }, [printWhat]);

  const CoverT = (COVER_TEMPLATES.find((t) => t.id === coverTpl) || COVER_TEMPLATES[0]).Component;
  const IndexT = (INDEX_TEMPLATES.find((t) => t.id === indexTpl) || INDEX_TEMPLATES[0]).Component;
  const templates = tab === "cover" ? COVER_TEMPLATES : INDEX_TEMPLATES;
  const activeTpl = tab === "cover" ? coverTpl : indexTpl;
  const setTpl = tab === "cover" ? setCoverTpl : setIndexTpl;
  const page = tab === "cover" ? <CoverT d={cover} /> : <IndexT cover={cover} index={index} />;

  async function clearMine() {
    if (!(await confirm("Clear your personal details (name, ID, registration, session, contact) from this device?"))) return;
    setCover({ ...cover, student: emptyCover().student });
    notify("success", "Your personal details were cleared.");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/gtec-logo.jpeg" alt="" />
          <div>
            <strong>Lab Report Cover &amp; Index</strong>
            <span>Textile Engineering</span>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "cover"} className={tab === "cover" ? "on" : ""} onClick={() => setTab("cover")}>
            Cover
          </button>
          <button role="tab" aria-selected={tab === "index"} className={tab === "index" ? "on" : ""} onClick={() => setTab("index")}>
            Index
          </button>
        </nav>
        <div className={"save-state " + saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved on this device"}</div>
      </header>

      <div className="mobile-switch">
        <button className={mobileView === "edit" ? "on" : ""} onClick={() => setMobileView("edit")}>
          ✏️ Edit
        </button>
        <button className={mobileView === "preview" ? "on" : ""} onClick={() => setMobileView("preview")}>
          👁️ Preview
        </button>
      </div>

      <main className={"workspace show-" + mobileView}>
        <div className="left">
          {tab === "cover" ? (
            <CoverEditor d={cover} set={setCover} notify={notify} />
          ) : (
            <IndexEditor index={index} set={setIndex} notify={notify} confirm={confirm} />
          )}
          <div className="left-foot">
            <button type="button" className="btn-link danger" onClick={clearMine}>
              Clear my personal details
            </button>
          </div>
        </div>

        <div className="right">
          <div className="tpl-strip" aria-label="Templates">
            {templates.map((t) => {
              const T = t.Component;
              return (
                <button key={t.id} className={"tpl-card" + (t.id === activeTpl ? " on" : "")} onClick={() => setTpl(t.id)}>
                  <ScaledPage maxWidth={96}>{tab === "cover" ? <T d={cover} /> : <T cover={cover} index={index} />}</ScaledPage>
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="preview-area">
            <ScaledPage maxWidth={620}>{page}</ScaledPage>
          </div>

          <div className="actions-bar">
            <button className="btn-main" onClick={() => setPrintWhat(tab)}>
              🖨️ Print / Save {tab === "cover" ? "Cover" : "Index"}
            </button>
            <button className="btn-outline" onClick={() => setPrintWhat("both")}>
              Print both
            </button>
          </div>
          <p className="hint center">Temporary: uses your browser's print → "Save as PDF" (A4, Margins: None, Background graphics on). One-click PDF arrives in Phase 6.</p>
        </div>
      </main>

      {/* Full-size pages used only for printing */}
      <div className="print-root" aria-hidden="true">
        {(printWhat === "cover" || printWhat === "both") && <CoverT d={cover} />}
        {(printWhat === "index" || printWhat === "both") && <IndexT cover={cover} index={index} />}
      </div>

      {toast && (
        <div className={"toast " + toast.type} role="status" key={toast.id}>
          {toast.text}
        </div>
      )}

      {dialog && (
        <div className="modal-back" onClick={() => (dialog.resolve(false), setDialog(null))}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p>{dialog.text}</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => (dialog.resolve(false), setDialog(null))}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => (dialog.resolve(true), setDialog(null))}>
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
