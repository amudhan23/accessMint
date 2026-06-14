import { useEffect, useState } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import { Loader2, UserCheck } from "lucide-react";

const APP_ID =
  import.meta.env.VITE_WORLD_APP_ID || "app_dadcce7d32ab1fab4f18cf881a7e2795";
const ACTION = import.meta.env.VITE_WORLD_ID_ACTION || "marketplaceverify";
const WORLD_ID_ENVIRONMENT =
  import.meta.env.VITE_WORLD_ID_ENVIRONMENT || "staging";

function IrisMark({ label, loading, verified, onClick, disabled }) {
  const innerText = loading ? null : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={verified ? "World ID verified" : "Verify with World ID"}
      className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[9px] font-black uppercase leading-none tracking-wide transition ${
        verified
          ? "cursor-default border-emerald-300/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_32px_rgba(16,185,129,0.24)]"
          : "border-blue-300/25 bg-gray-950 text-white shadow-[0_0_32px_rgba(99,102,241,0.28)] hover:scale-105 hover:border-blue-200 disabled:cursor-wait disabled:opacity-60"
      }`}
    >
      <span className="absolute h-14 w-14 rounded-full border border-blue-300/20" />
      <span className="absolute h-10 w-10 rounded-full border border-violet-300/50 bg-violet-500/20" />
      <span className="absolute h-5 w-5 rounded-full border border-cyan-100/60 bg-blue-300/25" />
      <span className="absolute h-2.5 w-2.5 rounded-full bg-blue-100 shadow-[0_0_18px_rgba(147,197,253,0.85)]" />
      <span className="relative flex max-w-12 items-center justify-center text-center">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : innerText}
      </span>
    </button>
  );
}

export default function WorldIDVerify({ onVerified, children }) {
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: ACTION }),
    })
      .then((response) => response.json())
      .then((data) => {
        setRpContext({
          app_id: data.app_id || APP_ID,
          action: data.action || ACTION,
          rp_id: data.rp_id || import.meta.env.VITE_WORLD_RP_ID,
          nonce: data.nonce,
          created_at: data.created_at,
          expires_at: data.expires_at,
          signature: data.sig,
        });
      })
      .catch(console.error);
  }, []);

  if (verified) {
    return (
      <div>
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <UserCheck className="h-5 w-5 text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-white">
                World ID verified
              </p>
              <p className="text-xs text-gray-500">
                Unique human check complete for resale trading.
              </p>
            </div>
          </div>
          <IrisMark label="Verified" verified disabled />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/15 bg-blue-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            World ID gated marketplace
          </p>
          <p className="text-xs text-gray-500">
            One quick human check before buying resale tokens.
          </p>
        </div>
        <IrisMark
          label="Verify"
          loading={!rpContext}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          disabled={!rpContext}
        />
      </div>

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={rpContext.app_id}
          action={rpContext.action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={WORLD_ID_ENVIRONMENT}
          preset={orbLegacy()}
          handleVerify={async (result) => {
            setError("");
            const res = await fetch("/api/verify-worldid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                app_id: rpContext.app_id,
                rp_id: rpContext.rp_id,
                idkitResponse: result,
              }),
            });
            const verification = await res.json().catch(() => ({}));
            if (!res.ok || !verification.verified) {
              const message =
                verification?.error?.detail ||
                verification?.error?.message ||
                verification?.message ||
                "World ID verification failed";
              setError(message);
              throw new Error(message);
            }
            setVerified(true);
            if (onVerified) onVerified(verification);
          }}
          onSuccess={() => console.log("World ID verified")}
        />
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="pointer-events-none opacity-40">{children}</div>
    </div>
  );
}
