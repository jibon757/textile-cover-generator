// Cover + Index generator with live A4 preview, shared colleges/designs and optional Google cloud save.
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { emptyCover, emptyIndex, toNumber } from "./data.js";
import { COVER_TEMPLATES } from "./templates/covers.jsx";
import { INDEX_TEMPLATES } from "./templates/indexes.jsx";
import { CoverEditor, IndexEditor } from "./components/Editors.jsx";
import ScaledPage from "./components/ScaledPage.jsx";
import { auth, signInAnonymously, onAuthStateChanged, signOut, signInWithGoogle, googleErrorMessage } from "./firebase.js";
import { api } from "./api.js";
import DesignLibrary, { designFromCover } from "./components/DesignLibrary.jsx";
import { downloadPdf, pdfFileName } from "./pdf.js";
import { siteSettings, loadSiteSettings } from "./siteSettings.js";

const AdminPanel = lazy(() => import("./components/AdminPanel.jsx"));

const DRAFT_KEY = "tcg.draft.v1";

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const base = emptyCover();
    return {
      cover: {
        ...base,
        ...d.cover,
        level: toNumber(d.cover?.level),
        term: toNumber(d.cover?.term),
        student: { ...base.student, ...d.cover?.student },
        teacher: { ...base.teacher, ...d.cover?.teacher },
      },
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
  const [exportWhat, setExportWhat] = useState(null); // null | "cover" | "index" | "both"
  const exportRef = useRef(null);
  const [saveState, setSaveState] = useState("saved");
  const [user, setUser] = useState(null);
  const [cloudReady, setCloudReady] = useState(false); // true after the Google copy was loaded
  const [cloudState, setCloudState] = useState(""); // "" | "saving" | "saved" | "error"
  const [stats, setStats] = useState({ cover: {}, index: {} });
  const [library, setLibrary] = useState(null); // { approved, common } pictures
  const [trials, setTrials] = useState([]); // AI trial pictures (only in this browser tab, never saved)
  const [designsVersion, setDesignsVersion] = useState(0);
  const isGoogle = !!user && !user.isAnonymous;
  const [settings, setSettings] = useState({ ...siteSettings });
  const [route, setRoute] = useState(() => window.location.hash);
  const [isAdmin, setIsAdmin] = useState(false);

  const notify = useCallback((type, text) => {
    setToast({ type, text, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const confirm = useCallback((text) => new Promise((resolve) => setDialog({ text, resolve })), []);

  // Visitor ID: anonymous by default (no personal data), Google only if the visitor chooses.
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return stop;
  }, []);

  // Owner's settings (notice, AI on/off, limits, hidden templates).
  const reloadSettings = useCallback(() => loadSiteSettings().then(setSettings), []);
  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  // "#admin" in the address opens the Admin panel.
  useEffect(() => {
    const on = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // Show the Admin link only to the owner (the server checks again on every admin action).
  useEffect(() => {
    if (!isGoogle) return setIsAdmin(false);
    api("/api/admin/me")
      .then((r) => setIsAdmin(!!r.admin))
      .catch(() => setIsAdmin(false));
  }, [isGoogle, user?.uid]);

  // A template the owner hid is switched to the first visible one.
  useEffect(() => {
    const fix = (list, hidden, cur, set) => {
      if (!hidden?.includes(cur)) return;
      const next = list.find((t) => !hidden.includes(t.id));
      if (next) set(next.id);
    };
    fix(COVER_TEMPLATES, settings.hiddenCover, coverTpl, setCoverTpl);
    fix(INDEX_TEMPLATES, settings.hiddenIndex, indexTpl, setIndexTpl);
  }, [settings, coverTpl, indexTpl]);

  // Template ranking: most downloaded first.
  useEffect(() => {
    api("/api/stats", { auth: false })
      .then((r) => setStats(r.stats))
      .catch(() => {});
  }, []);

  // Picture library (approved AI pictures + common pictures).
  const loadLibrary = useCallback(async () => {
    try {
      const r = await api("/api/images", { auth: false });
      setLibrary({ approved: r.approved || [], common: r.common || [] });
    } catch (err) {
      setLibrary({ approved: [], common: [], error: "Pictures could not be loaded: " + err.message });
    }
  }, []);
  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // After a successful cover download: approve the AI picture (if one is used) and
  // save the design for everyone (no personal details). Never blocks the download.
  async function afterCoverDownload(c) {
    let used = c;
    if (c.illustrationTrial && c.illustration?.startsWith("data:")) {
      try {
        const r = await api("/api/images/approve", { method: "POST", body: { image: c.illustration, token: c.illustrationTrial } });
        used = { ...c, illustration: r.url, illustrationTrial: null };
        const trialImage = c.illustration;
        setCover((cv) => (cv.illustration === trialImage ? { ...cv, illustration: r.url, illustrationTrial: null } : cv));
        setTrials((t) => t.filter((x) => x.image !== trialImage));
        loadLibrary();
      } catch (err) {
        if (err.code === "trial_expired" || err.code === "trial_mismatch") setCover((cv) => ({ ...cv, illustrationTrial: null }));
        used = { ...c, illustration: "" }; // the trial picture itself is never shared
      }
    } else if (c.illustration?.startsWith("data:")) {
      // The student's own picture: shared in the library after the download (owner's rule).
      try {
        const r = await api("/api/images/share", { method: "POST", body: { image: c.illustration, subjectName: c.subjectName, subjectCode: c.subjectCode } });
        used = { ...c, illustration: r.url };
        const ownImage = c.illustration;
        setCover((cv) => (cv.illustration === ownImage ? { ...cv, illustration: r.url } : cv));
        loadLibrary();
      } catch {
        used = { ...c, illustration: "" };
      }
    }
    if (!used.subjectName.trim()) return;
    // A ready picture (not AI, not own upload): link it to this subject for next time.
    if (c.illustration && !c.illustration.startsWith("data:") && !c.illustrationTrial) {
      api("/api/images/link", { method: "POST", body: { url: c.illustration, subjectName: c.subjectName, subjectCode: c.subjectCode } })
        .then((r) => !r.existed && !r.skipped && loadLibrary())
        .catch(() => {});
    }
    try {
      const r = await api("/api/designs", { method: "POST", body: { design: designFromCover(used, coverTpl, indexTpl) } });
      if (!r.existed) setDesignsVersion((v) => v + 1);
    } catch {
      /* saving the shared design is a bonus; the download already worked */
    }
  }

  // When signed in with Google: load the copy saved in the cloud once.
  useEffect(() => {
    if (!isGoogle) {
      setCloudReady(false);
      setCloudState("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { doc } = await api("/api/my/doc");
        if (cancelled) return;
        if (doc?.cover) {
          const localHasData = !!(cover.student.name || cover.student.id);
          const same = JSON.stringify(doc.cover.student) === JSON.stringify(cover.student);
          if (!localHasData || same || (await confirm("Load the details saved in your Google account? (This replaces what is on this device now.)"))) {
            const base = emptyCover();
            setCover({ ...base, ...doc.cover, level: toNumber(doc.cover.level), term: toNumber(doc.cover.term), student: { ...base.student, ...doc.cover.student }, teacher: { ...base.teacher, ...doc.cover.teacher } });
            if (doc.index?.rows?.length) setIndex(doc.index);
            if (doc.coverTpl) setCoverTpl(doc.coverTpl);
            if (doc.indexTpl) setIndexTpl(doc.indexTpl);
          }
        }
        if (!cancelled) setCloudReady(true);
      } catch (err) {
        if (!cancelled) {
          setCloudState("error");
          notify("error", "Could not load your cloud copy: " + err.message);
          setCloudReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoogle, user?.uid]);

  // While signed in with Google: also save to the cloud (owner-only).
  useEffect(() => {
    if (!isGoogle || !cloudReady) return;
    setCloudState("saving");
    const t = setTimeout(async () => {
      let doc = { cover, index, coverTpl, indexTpl };
      if (JSON.stringify(doc).length > 850_000) {
        // Very large device pictures stay on this device only.
        const strip = (u) => (u && u.startsWith("data:") ? "" : u);
        doc = { ...doc, cover: { ...cover, logo: strip(cover.logo), illustration: strip(cover.illustration), illustrationTrial: null } };
      }
      try {
        await api("/api/my/doc", { method: "PUT", body: { doc } });
        setCloudState("saved");
      } catch (err) {
        setCloudState("error");
        if (err.status !== 429) notify("error", "Cloud save failed: " + err.message + " Your work is still saved on this device.");
      }
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, index, coverTpl, indexTpl, isGoogle, cloudReady]);

  async function googleIn() {
    try {
      await signInWithGoogle();
      notify("success", "Signed in. Your details will also be saved in your Google account.");
    } catch (err) {
      notify("error", googleErrorMessage(err));
    }
  }
  async function googleOut() {
    const clear = await confirm("Sign out? Press 'Yes' to also remove your personal details from this device (good on a shared phone/computer).");
    try {
      await signOut(auth);
      if (clear) setCover((c) => ({ ...c, student: emptyCover().student }));
      notify("success", "Signed out.");
    } catch {
      notify("error", "Sign-out failed. Please try again.");
    }
  }

  function pickCollege(c) {
    setCover((cv) => ({ ...cv, collegeId: c.id, collegeName: c.name, logo: c.logoUrl || "" }));
  }

  function applyDesign(d) {
    setCover((cv) => ({
      ...cv,
      subjectName: d.subjectName || "",
      subjectCode: d.subjectCode || "",
      reportType: d.reportType || cv.reportType,
      department: d.department || cv.department,
      level: toNumber(d.level) || cv.level,
      term: toNumber(d.term) || cv.term,
      collegeId: d.collegeId || cv.collegeId,
      collegeName: d.collegeName || cv.collegeName,
      logo: d.logoUrl || cv.logo,
      illustration: d.illustration || cv.illustration,
      illustrationTrial: d.illustration ? null : cv.illustrationTrial,
      feather: typeof d.feather === "number" ? d.feather : cv.feather,
      featherShape: d.featherShape || cv.featherShape,
      blend: d.blend !== false,
    }));
    if (COVER_TEMPLATES.some((t) => t.id === d.coverTemplate)) setCoverTpl(d.coverTemplate);
    if (INDEX_TEMPLATES.some((t) => t.id === d.indexTemplate)) setIndexTpl(d.indexTemplate);
    notify("success", "Design applied. Now add your own details.");
  }

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

  // Download: render the chosen pages full-size (off-screen), let text sizes settle,
  // then send them to the server which returns a real A4 PDF.
  useEffect(() => {
    if (!exportWhat) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts?.ready;
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
        await downloadPdf(exportRef.current, pdfFileName(cover, exportWhat), { what: exportWhat, coverTemplate: coverTpl, indexTemplate: indexTpl });
        notify("success", "PDF downloaded.");
        if (exportWhat === "cover" || exportWhat === "both") afterCoverDownload(cover);
      } catch (err) {
        notify("error", err.message);
      } finally {
        if (!cancelled) setExportWhat(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportWhat]);

  const CoverT = (COVER_TEMPLATES.find((t) => t.id === coverTpl) || COVER_TEMPLATES[0]).Component;
  const IndexT = (INDEX_TEMPLATES.find((t) => t.id === indexTpl) || INDEX_TEMPLATES[0]).Component;
  const kindStats = (tab === "cover" ? stats.cover : stats.index) || {};
  const hiddenIds = (tab === "cover" ? settings.hiddenCover : settings.hiddenIndex) || [];
  const allOfKind = tab === "cover" ? COVER_TEMPLATES : INDEX_TEMPLATES;
  const visibleOfKind = allOfKind.filter((t) => !hiddenIds.includes(t.id));
  const templates = [...(visibleOfKind.length ? visibleOfKind : allOfKind)].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (kindStats[b.id] || 0) - (kindStats[a.id] || 0),
  );
  const activeTpl = tab === "cover" ? coverTpl : indexTpl;
  const setTpl = tab === "cover" ? setCoverTpl : setIndexTpl;
  const page = tab === "cover" ? <CoverT d={cover} /> : <IndexT cover={cover} index={index} />;

  async function clearMine() {
    if (!(await confirm("Clear your personal details (name, ID, registration, session, contact) from this device?"))) return;
    setCover({ ...cover, student: emptyCover().student });
    notify("success", "Your personal details were cleared.");
  }

  const toastAndDialog = (
    <>
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
    </>
  );

  if (route === "#admin") {
    return (
      <>
        <Suspense fallback={<p className="adm-empty"><span className="spinner dark" /> Loading admin…</p>}>
          <AdminPanel
            user={user}
            isGoogle={isGoogle}
            googleIn={googleIn}
            googleOut={googleOut}
            notify={notify}
            confirm={confirm}
            onExit={() => (window.location.hash = "")}
            onSettingsSaved={reloadSettings}
          />
        </Suspense>
        {toastAndDialog}
      </>
    );
  }

  return (
    <div className="app">
      {settings.notice && <div className="site-notice">📢 {settings.notice}</div>}
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
        <div className={"save-state " + (isGoogle ? cloudState || "saving" : saveState)}>
          {isGoogle
            ? cloudState === "saved"
              ? "Saved to your Google account"
              : cloudState === "error"
                ? "Cloud save failed · saved on this device"
                : "Saving to your Google account…"
            : saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Not saved"
                : "Saved on this device"}
        </div>
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
            <CoverEditor
              d={cover}
              set={setCover}
              notify={notify}
              onPickCollege={pickCollege}
              imageProps={{ confirm, library, reloadLibrary: loadLibrary, trials, setTrials, settings }}
            >
              <DesignLibrary templateNames={Object.fromEntries(COVER_TEMPLATES.map((t) => [t.id, t.name]))} onApply={applyDesign} version={designsVersion} />
            </CoverEditor>
          ) : (
            <IndexEditor index={index} set={setIndex} notify={notify} confirm={confirm} />
          )}
          <div className="left-foot">
            <div className="account-box">
              {isGoogle ? (
                <>
                  <span>
                    ☁️ Signed in as <strong>{user.email || user.displayName || "Google user"}</strong>
                  </span>
                  <button type="button" className="btn-link" onClick={googleOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <span>Want your details on every device? (optional)</span>
                  <button type="button" className="btn-google" onClick={googleIn}>
                    <span aria-hidden="true">G</span> Sign in with Google
                  </button>
                </>
              )}
            </div>
            <button type="button" className="btn-link danger" onClick={clearMine}>
              Clear my personal details
            </button>
            {isAdmin && (
              <a className="btn-link admin-link" href="#admin">
                ⚙️ Admin panel
              </a>
            )}
            <p className="credit">
              Developed by{" "}
              <a href="https://www.facebook.com/jibon.mistry.24400" target="_blank" rel="noopener noreferrer">
                Jibon Mistry
              </a>
            </p>
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
                  {kindStats[t.id] > 0 && <small className="dl-count">⬇ {kindStats[t.id]}</small>}
                </button>
              );
            })}
          </div>

          <div className="preview-area">
            <ScaledPage maxWidth={620}>{page}</ScaledPage>
          </div>

          <div className="actions-bar">
            <button className="btn-main" disabled={!!exportWhat} onClick={() => setExportWhat(tab)}>
              {exportWhat === tab ? <span className="spinner" /> : "⬇️"} Download {tab === "cover" ? "Cover" : "Index"} PDF
            </button>
            <button className="btn-outline" disabled={!!exportWhat} onClick={() => setExportWhat("both")}>
              {exportWhat === "both" ? <span className="spinner dark" /> : null} Cover + Index (one PDF)
            </button>
          </div>
          <p className="hint center">{exportWhat ? "Making your A4 PDF… (a few seconds)" : "Real A4 PDF, ready to print."}</p>
        </div>
      </main>

      {/* Phones: download buttons always reachable at the bottom of the screen */}
      <div className="mobile-dl">
        <button className="btn-main" disabled={!!exportWhat} onClick={() => setExportWhat(tab)}>
          {exportWhat === tab ? <span className="spinner" /> : "⬇️"} {tab === "cover" ? "Cover" : "Index"} PDF
        </button>
        <button className="btn-outline" disabled={!!exportWhat} onClick={() => setExportWhat("both")}>
          {exportWhat === "both" ? <span className="spinner dark" /> : null} Cover + Index
        </button>
      </div>

      {/* Full-size pages used only for making the PDF (kept off-screen) */}
      <div className="export-root" aria-hidden="true" ref={exportRef}>
        {(exportWhat === "cover" || exportWhat === "both") && <CoverT d={cover} />}
        {(exportWhat === "index" || exportWhat === "both") && <IndexT cover={cover} index={index} />}
      </div>

      {toastAndDialog}
    </div>
  );
}
