// Phase 2 page: proves the website, the /api backend, and Firebase all work.
// The real generator UI arrives in Phase 3.
import { useEffect, useState } from "react";
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";

function Check({ label, state, detail }) {
  const icon = state === "ok" ? "✅" : state === "fail" ? "❌" : "⏳";
  return (
    <li className={"check " + state}>
      <span className="icon">{icon}</span>
      <div>
        <strong>{label}</strong>
        {detail && <div className="detail">{detail}</div>}
      </div>
    </li>
  );
}

export default function App() {
  const [api, setApi] = useState({ state: "wait", detail: "" });
  const [fb, setFb] = useState({ state: "wait", detail: "" });

  async function runChecks() {
    setApi({ state: "wait", detail: "Checking…" });
    setFb({ state: "wait", detail: "Checking…" });

    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("Server said not OK");
      setApi({ state: "ok", detail: `Version ${data.version} · ${new Date(data.time).toLocaleString()}` });
    } catch (e) {
      setApi({ state: "fail", detail: "Could not reach /api/health: " + e.message });
    }

    try {
      const cred = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
      setFb({ state: "ok", detail: "Anonymous visitor ID: " + cred.user.uid.slice(0, 8) + "…" });
    } catch (e) {
      const hint = e.code === "auth/admin-restricted-operation" || e.code === "auth/operation-not-allowed"
        ? " (Turn on Anonymous in Firebase → Authentication → Sign-in method)"
        : "";
      setFb({ state: "fail", detail: (e.code || e.message) + hint });
    }
  }

  useEffect(() => {
    runChecks();
    return onAuthStateChanged(auth, () => {});
  }, []);

  return (
    <main className="page">
      <header className="hero">
        <img src="/gtec-logo.jpeg" alt="Gopalganj Textile Engineering College logo" className="logo" />
        <div>
          <h1>Textile Lab Report Cover &amp; Index Generator</h1>
          <p className="sub">Gopalganj Textile Engineering College, Gopalganj</p>
        </div>
      </header>

      <section className="card">
        <h2>Phase 2 · System check</h2>
        <ul className="checks">
          <Check label="Website is live" state="ok" detail="You are seeing this page." />
          <Check label="Backend (/api/health)" {...api} />
          <Check label="Firebase anonymous sign-in" {...fb} />
        </ul>
        <div className="actions">
          <button onClick={runChecks}>Run checks again</button>
          <a className="btn-outline" href="/api/health" target="_blank" rel="noreferrer">Open /api/health</a>
        </div>
      </section>

      <p className="note">Cover and Index generator arrive in Phase 3.</p>
    </main>
  );
}
