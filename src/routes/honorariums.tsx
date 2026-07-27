import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";

export const Route = createFileRoute("/honorariums")({
  head: () => ({ meta: [
    { title: "الإكراميات السنوية — تكريم المسابقة الرمضانية" },
    { name: "description", content: "توثيق الإكراميات النقدية والعينية للمعلمين والطلاب والأيتام والأسر" },
  ]}),
  component: HonorariumsPage,
});

type Kind = "teacher" | "student" | "orphan" | "needy" | "best_family";
const KIND_LABEL: Record<Kind, string> = { teacher: "المعلمون", student: "الطلاب", orphan: "الأيتام", needy: "الأسر المحتاجة", best_family: "أفضل أسرة" };

interface Row {
  id: string; year: string; recipient_kind: Kind; recipient_name: string;
  cash_amount: number; in_kind_description: string | null; in_kind_value: number; notes: string | null;
}

interface NameOption { label: string; value: string }

function HonorariumsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Kind>("teacher");
  const [nameOptions, setNameOptions] = useState<Record<Kind, NameOption[]>>({ teacher: [], student: [], orphan: [], needy: [], best_family: [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ recipient_name: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const [hRes, tRes, sRes, bRes] = await Promise.all([
      supabase.from("honorariums").select("*").eq("user_id", user.id).eq("year", year).order("recipient_name"),
      supabase.from("teachers").select("name").eq("user_id", user.id).order("name"),
      supabase.from("students").select("name").eq("user_id", user.id).order("name"),
      supabase.from("beneficiaries").select("name,kind").eq("user_id", user.id).order("name"),
    ]);
    setRows((hRes.data || []) as Row[]);
    const b = (bRes.data || []) as { name: string; kind: string }[];
    setNameOptions({
      teacher: (tRes.data || []).map((t: { name: string }) => ({ label: t.name, value: t.name })),
      student: (sRes.data || []).map((s: { name: string }) => ({ label: s.name, value: s.name })),
      orphan: b.filter((x) => x.kind === "orphan").map((x) => ({ label: x.name, value: x.name })),
      needy: b.filter((x) => x.kind === "needy").map((x) => ({ label: x.name, value: x.name })),
      best_family: b.filter((x) => x.kind === "best_family").map((x) => ({ label: x.name, value: x.name })),
    });
  }, [user, year]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => r.recipient_kind === tab), [rows, tab]);
  const totals = useMemo(() => {
    const cash = filtered.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
    const inkind = filtered.reduce((s, r) => s + Number(r.in_kind_value || 0), 0);
    return { cash, inkind, total: cash + inkind };
  }, [filtered]);

  const openNew = () => { setEditing(null); setForm({ recipient_name: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", notes: "" }); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ recipient_name: r.recipient_name, cash_amount: String(r.cash_amount), in_kind_description: r.in_kind_description || "", in_kind_value: String(r.in_kind_value), notes: r.notes || "" }); setOpen(true); };

  const save = async () => {
    if (!user || !form.recipient_name.trim()) { toast.error("اسم المستفيد مطلوب"); return; }
    const payload = {
      recipient_name: form.recipient_name.trim(),
      cash_amount: Number(form.cash_amount) || 0,
      in_kind_description: form.in_kind_description || null,
      in_kind_value: Number(form.in_kind_value) || 0,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("honorariums").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("honorariums").insert({ user_id: user.id, year, recipient_kind: tab, ...payload });
    }
    toast.success("تم الحفظ");
    setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    await supabase.from("honorariums").delete().eq("id", id);
    load();
  };

  const changeYear = async (y: string) => { setYear(y); await setActiveYear(y); };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">الإكراميات السنوية</h1>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary w-fit">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">السنة:</span>
          <Select value={year} onValueChange={changeYear}>
            <SelectTrigger className="w-32 bg-background font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <TabsList>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <TabsTrigger key={k} value={k}>{KIND_LABEL[k]}</TabsTrigger>
              ))}
            </TabsList>
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إضافة إكرامية</Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">نقدي</div><div className="text-lg font-bold">{totals.cash.toLocaleString()}</div></div>
            <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">عيني (تقدير)</div><div className="text-lg font-bold">{totals.inkind.toLocaleString()}</div></div>
            <div className="bg-primary/10 p-3 rounded-md border-2 border-primary text-center"><div className="text-xs text-primary">الإجمالي</div><div className="text-lg font-bold text-primary">{totals.total.toLocaleString()}</div></div>
          </div>

          <TabsContent value={tab}>
            <div className="bg-card rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary/10">
                  <tr>
                    <th className="p-2 text-right">المستفيد</th>
                    <th className="p-2 text-right">نقدي</th>
                    <th className="p-2 text-right">عيني (وصف)</th>
                    <th className="p-2 text-right">قيمة العيني</th>
                    <th className="p-2 text-right">ملاحظات</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد إكراميات في هذا القسم لعام {year}هـ</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 font-semibold">{r.recipient_name}</td>
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
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل إكرامية" : `إضافة إكرامية — ${KIND_LABEL[tab]} — ${year}هـ`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">المستفيد *</label>
              {nameOptions[tab].length > 0 ? (
                <Select value={form.recipient_name} onValueChange={(v) => setForm({ ...form, recipient_name: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر أو اكتب" /></SelectTrigger>
                  <SelectContent>
                    {nameOptions[tab].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <Input className="mt-1" placeholder="أو اكتب الاسم" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm">نقدي</label><Input type="number" value={form.cash_amount} onChange={(e) => setForm({ ...form, cash_amount: e.target.value })} /></div>
              <div><label className="text-sm">قيمة العيني (تقدير)</label><Input type="number" value={form.in_kind_value} onChange={(e) => setForm({ ...form, in_kind_value: e.target.value })} /></div>
            </div>
            <div><label className="text-sm">وصف الإكرامية العينية</label><Input value={form.in_kind_description} onChange={(e) => setForm({ ...form, in_kind_description: e.target.value })} /></div>
            <div><label className="text-sm">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
