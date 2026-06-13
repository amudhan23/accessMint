import { useEffect, useState } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import { ShieldCheck, UserCheck } from "lucide-react";

const APP_ID = "app_e69a17a2a0942d9dd02e466d5d477dc1";
const ACTION = "marketplace-verify";

export default function WorldIDVerify({ onVerified, children }) {
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);

  useEffect(() => {
    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: ACTION }),
    })
      .then((response) => response.json())
      .then((data) => {
        setRpContext({
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
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
          <UserCheck className="h-4 w-4 text-emerald-300" />
          <span className="text-sm text-emerald-300">Verified Human</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900/80 p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-gray-500" />
        <div>
          <p className="font-medium text-white">Human Verification Required</p>
          <p className="mt-1 text-sm text-gray-500">
            Verify with World ID to access the marketplace. This prevents bots from manipulating
            prices.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!rpContext}
          className="mx-auto rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
        >
          {rpContext ? "Verify with World ID" : "Loading..."}
        </button>
      </div>

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment="staging"
          preset={orbLegacy()}
          handleVerify={async (result) => {
            const res = await fetch("/api/verify-worldid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rp_id: rpContext.rp_id,
                idkitResponse: result,
              }),
            });
            if (!res.ok) throw new Error("Verification failed");
            setVerified(true);
            if (onVerified) onVerified(result);
          }}
          onSuccess={() => console.log("World ID verified")}
        />
      )}

      <div className="pointer-events-none opacity-40">{children}</div>
    </div>
  );
}
