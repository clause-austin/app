"use client";

import { useState } from "react";
import { useBuyer } from "./buyer";

/** Name + passcode, in the grid style. New name creates an account; known name needs its passcode. */
export function SignInInline({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const { signIn } = useBuyer();
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await signIn(name, pass);
          onDone?.();
        } catch (er) {
          setErr((er as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid-lines grid-cols-2 border-b border-fg">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="username" className="field cell" />
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Passcode" autoComplete="current-password" className="field cell" />
      </div>
      {!compact && <p className="px-4 py-3 text-[11px] leading-relaxed text-mute">A new name makes an account. A known name needs its passcode. No wallet, no seed phrase: the chain is our problem.</p>}
      {err && <p className="px-4 pb-2 text-[11px] font-bold text-acc">{err}</p>}
      <button disabled={busy || !name.trim() || pass.length < 4} className="btn">
        <span>{busy ? "One sec" : "Continue"}</span>
        <span>→</span>
      </button>
    </form>
  );
}
