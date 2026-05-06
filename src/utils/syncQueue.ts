import { supabase } from "@/integrations/supabase/client";

export type QueueOp =
  | { kind: "upsert"; table: string; values: Record<string, unknown> | Record<string, unknown>[]; onConflict?: string }
  | { kind: "update"; table: string; values: Record<string, unknown>; match: Record<string, unknown> }
  | { kind: "delete"; table: string; match: Record<string, unknown> };

interface QueueItem { id: string; op: QueueOp; ts: number; tries: number; }

const KEY = "sync_queue_v1";
const listeners = new Set<() => void>();
let flushing = false;

const isBrowser = () => typeof window !== "undefined";

function load(): QueueItem[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(q: QueueItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(q));
}
function notify() { listeners.forEach((l) => l()); }

export function pendingCount(): number { return load().length; }
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function enqueue(op: QueueOp) {
  const q = load();
  q.push({ id: (crypto as Crypto).randomUUID(), op, ts: Date.now(), tries: 0 });
  save(q);
  notify();
  // try to flush in case we just came back online
  if (isBrowser() && navigator.onLine) void flush();
}

function isNetworkError(e: unknown): boolean {
  if (!isBrowser()) return false;
  if (!navigator.onLine) return true;
  const msg = (e as { message?: string })?.message?.toLowerCase() || "";
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
}

async function execute(op: QueueOp) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = supabase.from(op.table as any);
  if (op.kind === "upsert") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await tbl.upsert(op.values as any, op.onConflict ? { onConflict: op.onConflict } : undefined);
    if (r.error) throw r.error;
  } else if (op.kind === "update") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = tbl.update(op.values);
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw r.error;
  } else if (op.kind === "delete") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = tbl.delete();
    for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw r.error;
  }
}

export async function flush(): Promise<void> {
  if (!isBrowser() || flushing) return;
  if (!navigator.onLine) return;
  flushing = true;
  try {
    let q = load();
    while (q.length) {
      const item = q[0];
      try {
        await execute(item.op);
        q = load();
        q.shift();
        save(q);
        notify();
      } catch (e) {
        if (isNetworkError(e)) {
          // stop, retry later
          break;
        }
        // permanent error -> drop after a few retries to avoid infinite loop
        item.tries = (item.tries || 0) + 1;
        if (item.tries >= 3) {
          console.error("Dropping failed sync op after retries", e, item);
          q = load();
          q.shift();
        } else {
          q = load();
          q[0] = item;
        }
        save(q);
        notify();
      }
    }
  } finally {
    flushing = false;
  }
}

/** Try a direct write; on network failure, enqueue for later sync. */
export async function tryOrQueue(direct: () => Promise<{ error: unknown } | null | void>, op: QueueOp): Promise<void> {
  if (isBrowser() && !navigator.onLine) {
    enqueue(op);
    return;
  }
  try {
    const r = await direct();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (r as any)?.error;
    if (err) {
      if (isNetworkError(err)) { enqueue(op); return; }
      throw err;
    }
  } catch (e) {
    if (isNetworkError(e)) { enqueue(op); return; }
    throw e;
  }
}

if (isBrowser()) {
  window.addEventListener("online", () => { void flush(); });
  // initial attempt shortly after load
  setTimeout(() => { void flush(); }, 1500);
}
