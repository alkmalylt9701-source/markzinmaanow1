import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Pencil, Trash2, ShoppingCart, Calendar, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "مصروفات الحفل - المسابقة الرمضانية" },
      { name: "description", content: "تسجيل مصروفات ومستلزمات الحفل السنوي للمسابقة الرمضانية." },
      { property: "og:title", content: "مصروفات الحفل" },
      { property: "og:description", content: "إدارة مشتريات ومستلزمات الحفل السنوي." },
    ],
  }),
  component: ExpensesPage,
});

interface Expense {
  id: string;
  year: string;
  item: string;
  category: string | null;
  cash_amount: number;
  in_kind_description: string | null;
  in_kind_value: number;
  supplier: string | null;
  notes: string | null;
}

const CATEGORIES = ["ضيافة", "هدايا ودروع", "طباعة شهادات", "تزيين وديكور", "أجهزة صوت", "مواصلات", "متنوعة"];

function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ item: "", category: "ضيافة", cash_amount: "0", in_kind_description: "", in_kind_value: "0", supplier: "", notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("ceremony_expenses").select("*").eq("user_id", user.id).eq("year", year).order("created_at", { ascending: false });
    setItems((data || []) as Expense[]);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ item: "", category: "ضيافة", cash_amount: "0", in_kind_description: "", in_kind_value: "0", supplier: "", notes: "" }); setOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ item: e.item, category: e.category || "متنوعة", cash_amount: String(e.cash_amount), in_kind_description: e.in_kind_description || "", in_kind_value: String(e.in_kind_value), supplier: e.supplier || "", notes: e.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.item.trim()) { toast.error("أدخل اسم البند"); return; }
    const payload = {
      user_id: user.id, year, item: form.item.trim(), category: form.category,
      cash_amount: Number(form.cash_amount) || 0, in_kind_description: form.in_kind_description || null,
      in_kind_value: Number(form.in_kind_value) || 0, supplier: form.supplier || null, notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("ceremony_expenses").update(payload).eq("id", editing.id);
      if (error) { toast.error("فشل التعديل"); return; }
    } else {
      const { error } = await supabase.from("ceremony_expenses").insert(payload);
      if (error) { toast.error("فشل الإضافة"); return; }
    }
    toast.success("تم الحفظ");
    setOpen(false);
    load();
  };

  const remove = async (e: Expense) => {
    if (!confirm(`حذف "${e.item}"؟`)) return;
    const { error } = await supabase.from("ceremony_expenses").delete().eq("id", e.id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    load();
  };

  const filtered = useMemo(() => filter === "all" ? items : items.filter((i) => i.category === filter), [items, filter]);
  const totalCash = filtered.reduce((s, i) => s + Number(i.cash_amount), 0);
  const totalInKind = filtered.reduce((s, i) => s + Number(i.in_kind_value), 0);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => { const k = i.category || "متنوعة"; m[k] = (m[k] || 0) + Number(i.cash_amount) + Number(i.in_kind_value); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground shadow-lg print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="شعار" className="h-12 w-12 rounded-full bg-white p-1" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">مصروفات الحفل السنوي</h1>
            <p className="text-sm opacity-90">مستلزمات وتجهيزات حفل ختام المسابقة</p>
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
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إضافة بند</Button>
          <Button onClick={() => window.print()} variant="secondary" className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
          <div className="mr-auto text-sm space-y-1">
            <div>نقدي: <span className="font-bold text-primary">{totalCash.toLocaleString("ar-SA")} ر.س</span></div>
            <div>عيني: <span className="font-bold text-primary">{totalInKind.toLocaleString("ar-SA")} ر.س</span></div>
            <div>الإجمالي: <span className="font-bold text-primary">{(totalCash + totalInKind).toLocaleString("ar-SA")} ر.س</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {byCategory.map(([k, v]) => (
            <div key={k} className="bg-card border rounded-lg p-3 text-sm">
              <div className="font-semibold text-primary">{k}</div>
              <div className="text-lg font-bold">{v.toLocaleString("ar-SA")} ر.س</div>
            </div>
          ))}
        </div>

        {loading ? <div className="text-center py-10">جارٍ التحميل...</div> : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">لا توجد مصروفات لسنة {year}هـ</p>
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-right">البند</th>
                  <th className="p-3">الفئة</th>
                  <th className="p-3">نقدي</th>
                  <th className="p-3">عيني</th>
                  <th className="p-3">المورد</th>
                  <th className="p-3 print:hidden">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 font-semibold">{e.item}{e.in_kind_description && <div className="text-xs text-muted-foreground font-normal">📦 {e.in_kind_description}</div>}</td>
                    <td className="p-3 text-center"><span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{e.category || "-"}</span></td>
                    <td className="p-3 text-center">{Number(e.cash_amount).toLocaleString("ar-SA")}</td>
                    <td className="p-3 text-center">{Number(e.in_kind_value).toLocaleString("ar-SA")}</td>
                    <td className="p-3 text-xs">{e.supplier || "-"}</td>
                    <td className="p-3 text-center print:hidden">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "تعديل بند" : "بند مصروفات جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm mb-1 block">اسم البند *</label><Input placeholder="مثال: طباعة 100 شهادة" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></div>
            <div>
              <label className="text-sm mb-1 block">الفئة</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm mb-1 block">مبلغ نقدي (ر.س)</label><Input type="number" value={form.cash_amount} onChange={(e) => setForm({ ...form, cash_amount: e.target.value })} /></div>
              <div><label className="text-sm mb-1 block">قيمة عيني (ر.س)</label><Input type="number" value={form.in_kind_value} onChange={(e) => setForm({ ...form, in_kind_value: e.target.value })} /></div>
            </div>
            <div><label className="text-sm mb-1 block">وصف العيني</label><Textarea value={form.in_kind_description} onChange={(e) => setForm({ ...form, in_kind_description: e.target.value })} /></div>
            <div><label className="text-sm mb-1 block">المورد</label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div><label className="text-sm mb-1 block">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
