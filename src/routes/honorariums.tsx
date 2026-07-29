import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Pencil, Trash2, Gift, Calendar, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/honorariums")({
  head: () => ({
    meta: [
      { title: "الإكراميات - المسابقة الرمضانية" },
      { name: "description", content: "توزيع الإكراميات النقدية والعينية للمعلمات والطلاب والأيتام والمساكين." },
      { property: "og:title", content: "توزيع الإكراميات" },
      { property: "og:description", content: "إدارة إكراميات المسابقة الرمضانية السنوية." },
    ],
  }),
  component: HonorariumsPage,
});

interface Honorarium {
  id: string;
  year: string;
  recipient_kind: string;
  recipient_ref_id: string | null;
  recipient_name: string;
  cash_amount: number;
  in_kind_description: string | null;
  in_kind_value: number;
  notes: string | null;
}

const KINDS = [
  { v: "teacher_f", l: "معلمة" },
  { v: "teacher_m", l: "معلم" },
  { v: "student_f", l: "طالبة" },
  { v: "student_m", l: "طالب" },
  { v: "orphan", l: "يتيم/ة" },
  { v: "poor", l: "مسكين/ة" },
  { v: "other", l: "أخرى" },
];

const kindLabel = (v: string) => KINDS.find((k) => k.v === v)?.l || v;

function HonorariumsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [items, setItems] = useState<Honorarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Honorarium | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ recipient_kind: "student_f", recipient_name: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("honorariums").select("*").eq("user_id", user.id).eq("year", year).order("created_at", { ascending: false });
    setItems((data || []) as Honorarium[]);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ recipient_kind: "student_f", recipient_name: "", cash_amount: "0", in_kind_description: "", in_kind_value: "0", notes: "" }); setOpen(true); };
  const openEdit = (h: Honorarium) => {
    setEditing(h);
    setForm({ recipient_kind: h.recipient_kind, recipient_name: h.recipient_name, cash_amount: String(h.cash_amount), in_kind_description: h.in_kind_description || "", in_kind_value: String(h.in_kind_value), notes: h.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.recipient_name.trim()) { toast.error("أدخل الاسم"); return; }
    const payload = {
      user_id: user.id, year, recipient_kind: form.recipient_kind, recipient_name: form.recipient_name.trim(),
      cash_amount: Number(form.cash_amount) || 0, in_kind_description: form.in_kind_description || null,
      in_kind_value: Number(form.in_kind_value) || 0, notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("honorariums").update(payload).eq("id", editing.id);
      if (error) { toast.error("فشل التعديل"); return; }
    } else {
      const { error } = await supabase.from("honorariums").insert(payload);
      if (error) { toast.error("فشل الإضافة"); return; }
    }
    toast.success("تم الحفظ");
    setOpen(false);
    load();
  };

  const remove = async (h: Honorarium) => {
    if (!confirm(`حذف إكرامية "${h.recipient_name}"؟`)) return;
    const { error } = await supabase.from("honorariums").delete().eq("id", h.id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    load();
  };

  const filtered = useMemo(() => filter === "all" ? items : items.filter((i) => i.recipient_kind === filter), [items, filter]);
  const totalCash = filtered.reduce((s, i) => s + Number(i.cash_amount), 0);
  const totalInKind = filtered.reduce((s, i) => s + Number(i.in_kind_value), 0);

  // Group summary by kind
  const summary = useMemo(() => {
    const m: Record<string, { cash: number; inKind: number; count: number }> = {};
    items.forEach((i) => {
      if (!m[i.recipient_kind]) m[i.recipient_kind] = { cash: 0, inKind: 0, count: 0 };
      m[i.recipient_kind].cash += Number(i.cash_amount);
      m[i.recipient_kind].inKind += Number(i.in_kind_value);
      m[i.recipient_kind].count += 1;
    });
    return m;
  }, [items]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground shadow-lg print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="شعار" className="h-12 w-12 rounded-full bg-white p-1" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">توزيع الإكراميات</h1>
            <p className="text-sm opacity-90">نقدية وعينية لجميع فئات المستفيدين</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-lg border print:hidden">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <Select value={year} onValueChange={async (y) => { setYear(y); await setActiveYear(y); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إضافة إكرامية</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
          <div className="mr-auto text-sm space-y-1">
            <div>النقدي: <span className="font-bold text-primary">{totalCash.toLocaleString("ar-SA")} ر.س</span></div>
            <div>العيني: <span className="font-bold text-primary">{totalInKind.toLocaleString("ar-SA")} ر.س</span></div>
          </div>
        </div>

        {/* Summary by kind */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="bg-card border rounded-lg p-3 text-sm">
              <div className="font-semibold text-primary">{kindLabel(k)}</div>
              <div className="text-xs text-muted-foreground">{v.count} مستفيد</div>
              <div className="mt-1">نقدي: {v.cash.toLocaleString("ar-SA")}</div>
              <div>عيني: {v.inKind.toLocaleString("ar-SA")}</div>
            </div>
          ))}
        </div>

        {loading ? <div className="text-center py-10">جارٍ التحميل...</div> : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <Gift className="h-16 w-16 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">لا توجد إكراميات لسنة {year}هـ</p>
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">الاسم</th>
                  <th className="p-3">الفئة</th>
                  <th className="p-3">نقدي</th>
                  <th className="p-3">عيني</th>
                  <th className="p-3 text-right">وصف العيني</th>
                  <th className="p-3 print:hidden">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-3 font-semibold">{h.recipient_name}</td>
                    <td className="p-3 text-center"><span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{kindLabel(h.recipient_kind)}</span></td>
                    <td className="p-3 text-center">{Number(h.cash_amount).toLocaleString("ar-SA")}</td>
                    <td className="p-3 text-center">{Number(h.in_kind_value).toLocaleString("ar-SA")}</td>
                    <td className="p-3 text-xs text-muted-foreground">{h.in_kind_description || "-"}</td>
                    <td className="p-3 text-center print:hidden">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(h)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل إكرامية" : "إكرامية جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm mb-1 block">الفئة</label>
              <Select value={form.recipient_kind} onValueChange={(v) => setForm({ ...form, recipient_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm mb-1 block">اسم المستفيد *</label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm mb-1 block">نقدي (ر.س)</label><Input type="number" value={form.cash_amount} onChange={(e) => setForm({ ...form, cash_amount: e.target.value })} /></div>
              <div><label className="text-sm mb-1 block">قيمة العيني (ر.س)</label><Input type="number" value={form.in_kind_value} onChange={(e) => setForm({ ...form, in_kind_value: e.target.value })} /></div>
            </div>
            <div><label className="text-sm mb-1 block">وصف الإكرامية العينية</label><Textarea placeholder="مثال: مصحف، سلة رمضانية، هدية..." value={form.in_kind_description} onChange={(e) => setForm({ ...form, in_kind_description: e.target.value })} /></div>
            <div><label className="text-sm mb-1 block">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
