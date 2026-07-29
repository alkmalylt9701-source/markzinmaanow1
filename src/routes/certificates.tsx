import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Award, Calendar, Printer, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/certificates")({
  head: () => ({
    meta: [
      { title: "الشهادات - المسابقة الرمضانية" },
      { name: "description", content: "إصدار شهادات تقدير وختم وشهادات مشاركة للطلاب والمعلمين في المسابقة الرمضانية." },
      { property: "og:title", content: "إصدار الشهادات" },
      { property: "og:description", content: "شهادات تقدير للخاتمين والمتميزين ومشاركة للمعلمين والمعلمات." },
    ],
  }),
  component: CertificatesPage,
});

interface Cert {
  id: string;
  year: string;
  cert_type: string;
  recipient_name: string;
  notes: string | null;
  created_at: string;
}

const CERT_TYPES = [
  { v: "khatm", l: "شهادة ختم", color: "bg-emerald-100 text-emerald-800" },
  { v: "excellence", l: "شهادة تميز", color: "bg-amber-100 text-amber-800" },
  { v: "participation_student", l: "مشاركة طالب/ة", color: "bg-blue-100 text-blue-800" },
  { v: "participation_teacher", l: "مشاركة معلم/ة", color: "bg-purple-100 text-purple-800" },
  { v: "appreciation", l: "شهادة تقدير", color: "bg-rose-100 text-rose-800" },
];

const typeLabel = (v: string) => CERT_TYPES.find((t) => t.v === v)?.l || v;
const typeColor = (v: string) => CERT_TYPES.find((t) => t.v === v)?.color || "bg-muted";

function CertificatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [items, setItems] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ cert_type: "khatm", recipient_name: "", notes: "" });
  const [preview, setPreview] = useState<Cert | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkNames, setBulkNames] = useState("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("certificates_issued").select("*").eq("user_id", user.id).eq("year", year).order("created_at", { ascending: false });
    setItems((data || []) as Cert[]);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ cert_type: "khatm", recipient_name: "", notes: "" }); setBulkMode(false); setBulkNames(""); setOpen(true); };

  const save = async () => {
    if (!user) return;
    if (bulkMode) {
      const names = bulkNames.split("\n").map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) { toast.error("أضف الأسماء"); return; }
      const rows = names.map((n) => ({ user_id: user.id, year, cert_type: form.cert_type, recipient_name: n, notes: form.notes || null }));
      const { error } = await supabase.from("certificates_issued").insert(rows);
      if (error) { toast.error("فشل الإضافة"); return; }
      toast.success(`تم إصدار ${names.length} شهادة`);
    } else {
      if (!form.recipient_name.trim()) { toast.error("أدخل الاسم"); return; }
      const { error } = await supabase.from("certificates_issued").insert({ user_id: user.id, year, cert_type: form.cert_type, recipient_name: form.recipient_name.trim(), notes: form.notes || null });
      if (error) { toast.error("فشل الإضافة"); return; }
      toast.success("تم إصدار الشهادة");
    }
    setOpen(false);
    load();
  };

  const remove = async (c: Cert) => {
    if (!confirm(`حذف شهادة "${c.recipient_name}"؟`)) return;
    const { error } = await supabase.from("certificates_issued").delete().eq("id", c.id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    load();
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.cert_type === filter);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground shadow-lg print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="شعار" className="h-12 w-12 rounded-full bg-white p-1" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">الشهادات</h1>
            <p className="text-sm opacity-90">شهادات تقدير وختم ومشاركة</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-lg border">
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
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {CERT_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إصدار شهادة</Button>
          <div className="mr-auto text-sm">
            <div>الإجمالي: <span className="font-bold text-primary">{filtered.length}</span> شهادة</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {CERT_TYPES.map((t) => {
            const count = items.filter((i) => i.cert_type === t.v).length;
            return (
              <div key={t.v} className="bg-card border rounded-lg p-3 text-center">
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${t.color}`}>{t.l}</div>
                <div className="text-2xl font-bold mt-1">{count}</div>
              </div>
            );
          })}
        </div>

        {loading ? <div className="text-center py-10">جارٍ التحميل...</div> : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <Award className="h-16 w-16 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">لا توجد شهادات مصدرة لسنة {year}هـ</p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-card border rounded-lg p-3 flex items-center gap-3">
                <Award className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{c.recipient_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor(c.cert_type)}`}>{typeLabel(c.cert_type)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setPreview(c)} title="معاينة وطباعة"><Printer className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-center text-muted-foreground p-3 border border-dashed rounded-lg">
          💡 حالياً يستخدم النظام قالب افتراضي أنيق للشهادات. عندما ترسلين قالب الشهادة الخاص بكم سأدمجه هنا لطباعة الشهادات بتصميمكم.
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إصدار شهادة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm mb-1 block">نوع الشهادة</label>
              <Select value={form.cert_type} onValueChange={(v) => setForm({ ...form, cert_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CERT_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-center text-sm">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={!bulkMode} onChange={() => setBulkMode(false)} /> اسم واحد
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={bulkMode} onChange={() => setBulkMode(true)} /> عدة أسماء (سطر لكل اسم)
              </label>
            </div>
            {bulkMode ? (
              <Textarea rows={6} placeholder="ضع كل اسم في سطر منفصل" value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} />
            ) : (
              <Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder="اسم المكرَّم" />
            )}
            <div><label className="text-sm mb-1 block">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>إصدار</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate preview - default template */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader className="print:hidden"><DialogTitle>معاينة الشهادة</DialogTitle></DialogHeader>
          <div id="cert-print" className="bg-gradient-to-br from-amber-50 via-white to-emerald-50 border-8 border-double border-primary/60 p-10 text-center relative aspect-[1.4/1]">
            <div className="absolute inset-4 border-2 border-primary/30 rounded-lg pointer-events-none" />
            <img src={logo} alt="شعار" className="h-20 w-20 mx-auto" />
            <p className="text-lg mt-2 font-semibold text-primary/80">مركز إنماء الأهلي الخيري</p>
            <h1 className="text-4xl font-black text-primary mt-4">{preview ? typeLabel(preview.cert_type) : ""}</h1>
            <div className="mt-8 leading-loose">
              <p className="text-lg">تشهد إدارة المسابقة الرمضانية بأن</p>
              <p className="text-3xl font-bold text-primary my-4 border-y-2 border-primary/40 py-3 mx-8">{preview?.recipient_name}</p>
              <p className="text-lg">قد شارك/ت في المسابقة الرمضانية لعام <span className="font-bold">{preview?.year}هـ</span></p>
              {preview?.notes && <p className="text-sm text-muted-foreground mt-3 italic">{preview.notes}</p>}
            </div>
            <div className="mt-10 flex justify-between text-sm px-8">
              <div>
                <div className="border-t-2 border-foreground pt-1 w-32">المشرفة العامة</div>
              </div>
              <div>
                <div className="border-t-2 border-foreground pt-1 w-32">التاريخ: {preview?.year}هـ</div>
              </div>
            </div>
          </div>
          <DialogFooter className="print:hidden">
            <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> طباعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cert-print, #cert-print * { visibility: visible; }
          #cert-print { position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh; }
        }
      `}</style>
    </div>
  );
}
