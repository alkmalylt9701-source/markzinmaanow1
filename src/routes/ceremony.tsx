import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";

export const Route = createFileRoute("/ceremony")({
  head: () => ({ meta: [
    { title: "مصروفات الحفل السنوي" },
    { name: "description", content: "توثيق مشتريات وخدمات الحفل الرمضاني السنوي" },
  ]}),
  component: CeremonyPage,
});

interface Row { id: string; year: string; item: string; category: string | null; cash_amount: number; in_kind_description: string | null; in_kind_value: number; supplier: string | null; notes: string | null; }

function CeremonyPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ item: "", category: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", supplier: "", notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("ceremony_expenses").select("*").eq("user_id", user.id).eq("year", year).order("created_at");
    setRows((data || []) as Row[]);
  }, [user, year]);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const cash = rows.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
    const inkind = rows.reduce((s, r) => s + Number(r.in_kind_value || 0), 0);
    return { cash, inkind, total: cash + inkind };
  }, [rows]);

  const openNew = () => { setEditing(null); setForm({ item: "", category: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", supplier: "", notes: "" }); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ item: r.item, category: r.category || "", cash_amount: String(r.cash_amount), in_kind_description: r.in_kind_description || "", in_kind_value: String(r.in_kind_value), supplier: r.supplier || "", notes: r.notes || "" }); setOpen(true); };

  const save = async () => {
    if (!user || !form.item.trim()) { toast.error("البند مطلوب"); return; }
    const payload = {
      item: form.item.trim(),
      category: form.category || null,
      cash_amount: Number(form.cash_amount) || 0,
      in_kind_description: form.in_kind_description || null,
      in_kind_value: Number(form.in_kind_value) || 0,
      supplier: form.supplier || null,
      notes: form.notes || null,
    };
    if (editing) await supabase.from("ceremony_expenses").update(payload).eq("id", editing.id);
    else await supabase.from("ceremony_expenses").insert({ user_id: user.id, year, ...payload });
    toast.success("تم الحفظ"); setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف؟")) return;
    await supabase.from("ceremony_expenses").delete().eq("id", id);
    load();
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">مصروفات الحفل</h1>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">السنة:</span>
            <Select value={year} onValueChange={async (y) => { setYear(y); await setActiveYear(y); }}>
              <SelectTrigger className="w-32 bg-background font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إضافة بند</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">صرفيات نقدية</div><div className="text-lg font-bold">{totals.cash.toLocaleString()}</div></div>
          <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">عينيات (قيمة)</div><div className="text-lg font-bold">{totals.inkind.toLocaleString()}</div></div>
          <div className="bg-primary/10 p-3 rounded-md border-2 border-primary text-center"><div className="text-xs text-primary">إجمالي تكلفة الحفل</div><div className="text-lg font-bold text-primary">{totals.total.toLocaleString()}</div></div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary/10">
              <tr>
                <th className="p-2 text-right">البند</th>
                <th className="p-2 text-right">التصنيف</th>
                <th className="p-2 text-right">المورد</th>
                <th className="p-2 text-right">نقدي</th>
                <th className="p-2 text-right">عيني</th>
                <th className="p-2 text-right">قيمة العيني</th>
                <th className="p-2 text-right">ملاحظات</th>
                <th className="p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد بنود لعام {year}هـ</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-semibold">{r.item}</td>
                  <td className="p-2">{r.category || "-"}</td>
                  <td className="p-2">{r.supplier || "-"}</td>
                  <td className="p-2">{Number(r.cash_amount).toLocaleString()}</td>
                  <td className="p-2 text-muted-foreground">{r.in_kind_description || "-"}</td>
                  <td className="p-2">{Number(r.in_kind_value).toLocaleString()}</td>
                  <td className="p-2 text-muted-foreground">{r.notes || "-"}</td>
                  <td className="p-2 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل بند" : `بند جديد — ${year}هـ`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">البند *</label><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm">التصنيف</label><Input placeholder="مثال: تجهيزات، ضيافة" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><label className="text-sm">المورد</label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm">مبلغ نقدي</label><Input type="number" value={form.cash_amount} onChange={(e) => setForm({ ...form, cash_amount: e.target.value })} /></div>
              <div><label className="text-sm">قيمة العيني</label><Input type="number" value={form.in_kind_value} onChange={(e) => setForm({ ...form, in_kind_value: e.target.value })} /></div>
            </div>
            <div><label className="text-sm">وصف العيني</label><Input value={form.in_kind_description} onChange={(e) => setForm({ ...form, in_kind_description: e.target.value })} /></div>
            <div><label className="text-sm">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
