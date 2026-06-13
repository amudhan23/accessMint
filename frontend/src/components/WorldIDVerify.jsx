import { useState, useEffect } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import { ShieldCheck, UserCheck } from "lucide-react";

const APP_ID = "app_e69a17a2a0942d9dd02e466d5d477dc1";
const ACTION = "marketplace-verify";

export default function WorldIDVerify({ onVerified, children }) {
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);
  const [rpId, setRpId] = useState(null);

  // Fetch RP signature from backend when component mounts
  useEffect(() => {
    fetch("/api/rp-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: ACTION }),
    })
      .then((r) => r.json())
      .then((data) => {
        setRpId(data.rp_id || import.meta.env.VITE_WORLD_RP_ID);
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
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-mint-500/10 border border-mint-500/20">
          <UserCheck className="w-4 h-4 text-mint-400" />
          <span className="text-sm text-mint-400">Verified Human</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 rounded-xl p-5 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-gray-500 mx-auto" />
        <div>
          <p className="font-medium">Human Verification Required</p>
          <p className="text-sm text-gray-500 mt-1">
            Verify with World ID to access the marketplace. This prevents bots
            from manipulating prices.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!rpContext}
          className="px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition disabled:opacity-50 mx-auto"
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
          onSuccess={() => console.log("World ID verified!")}
        />
      )}

      <div className="opacity-40 pointer-events-none">{children}</div>
    </div>
  );
}
