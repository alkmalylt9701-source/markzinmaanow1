import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Check } from "lucide-react";
import { pendingCount, subscribe, flush } from "@/utils/syncQueue";

export const SyncStatus = () => {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const update = () => {
      const c = pendingCount();
      setCount((prev) => {
        if (prev > 0 && c === 0) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 2500);
        }
        return c;
      });
    };
    update();
    const unsub = subscribe(update);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { unsub(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (count === 0 && online && !justSynced) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden">
      <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-lg border ${
        !online ? "bg-destructive text-destructive-foreground border-destructive" :
        count > 0 ? "bg-amber-500 text-white border-amber-600" :
        "bg-emerald-600 text-white border-emerald-700"
      }`}>
        {!online ? (
          <><CloudOff className="h-3.5 w-3.5" /><span>غير متصل · {count} عملية معلّقة</span></>
        ) : count > 0 ? (
          <><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>جارٍ المزامنة · {count}</span></>
        ) : (
          <><Check className="h-3.5 w-3.5" /><span>تمت المزامنة</span></>
        )}
      </div>
    </div>
  );
};
