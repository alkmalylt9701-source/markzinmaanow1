import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Upload, Trash2, Calendar, Award, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";

export const Route = createFileRoute("/certificates")({
  head: () => ({ meta: [
    { title: "الشهادات — ختم وتميز ومشاركة" },
    { name: "description", content: "إصدار شهادات الختم والتميز والمشاركة للطلاب والمعلمين" },
  ]}),
  component: CertificatesPage,
});

type CertType = "completion" | "excellence" | "participation" | "teacher_participation";
const TYPE_LABEL: Record<CertType, string> = {
  completion: "شهادة ختم",
  excellence: "شهادة تميز",
  participation: "شهادة مشاركة (طلاب)",
  teacher_participation: "شهادة مشاركة (معلمين)",
};

interface Template { id: string; cert_type: CertType; year: string | null; label: string; file_path: string; name_x: number; name_y: number; font_size: number; }
interface Issued { id: string; year: string; cert_type: CertType; recipient_name: string; template_id: string | null; created_at: string; }

function CertificatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [tab, setTab] = useState<CertType>("completion");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [issued, setIssued] = useState<Issued[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ label: "", name_x: "300", name_y: "400", font_size: "32", file: null as File | null });
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ names: "", template_id: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const [tRes, iRes] = await Promise.all([
      supabase.from("certificate_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("certificates_issued").select("*").eq("user_id", user.id).eq("year", year).order("created_at", { ascending: false }),
    ]);
    setTemplates((tRes.data || []) as Template[]);
    setIssued((iRes.data || []) as Issued[]);
  }, [user, year]);
  useEffect(() => { load(); }, [load]);

  const tabTemplates = useMemo(() => templates.filter((t) => t.cert_type === tab), [templates, tab]);
  const tabIssued = useMemo(() => issued.filter((i) => i.cert_type === tab), [issued, tab]);

  const uploadTemplate = async () => {
    if (!user || !uploadForm.file) { toast.error("اختر ملف PDF"); return; }
    const ext = uploadForm.file.name.split(".").pop() || "pdf";
    const path = `${user.id}/${tab}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("certificates").upload(path, uploadForm.file);
    if (error) { toast.error("فشل الرفع: " + error.message); return; }
    await supabase.from("certificate_templates").insert({
      user_id: user.id, cert_type: tab, year: null,
      label: uploadForm.label || uploadForm.file.name,
      file_path: path,
      name_x: Number(uploadForm.name_x) || 300,
      name_y: Number(uploadForm.name_y) || 400,
      font_size: Number(uploadForm.font_size) || 32,
    });
    toast.success("تم رفع القالب");
    setUploadOpen(false);
    setUploadForm({ label: "", name_x: "300", name_y: "400", font_size: "32", file: null });
    load();
  };

  const delTemplate = async (t: Template) => {
    if (!confirm("حذف القالب؟")) return;
    await supabase.storage.from("certificates").remove([t.file_path]);
    await supabase.from("certificate_templates").delete().eq("id", t.id);
    load();
  };

  const downloadTemplate = async (t: Template) => {
    const { data } = await supabase.storage.from("certificates").createSignedUrl(t.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const issue = async () => {
    if (!user) return;
    const names = issueForm.names.split(/\n|,|,/).map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) { toast.error("أدخل الأسماء"); return; }
    const rows = names.map((n) => ({ user_id: user.id, year, cert_type: tab, recipient_name: n, template_id: issueForm.template_id || null }));
    await supabase.from("certificates_issued").insert(rows);
    toast.success(`تم تسجيل ${names.length} شهادة`);
    setIssueOpen(false); setIssueForm({ names: "", template_id: "" });
    load();
  };

  const delIssued = async (id: string) => {
    if (!confirm("حذف السجل؟")) return;
    await supabase.from("certificates_issued").delete().eq("id", id);
    load();
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><Award className="h-5 w-5" /> الشهادات</h1>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary w-fit">
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

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
          <strong>ملاحظة:</strong> ارفع قوالب PDF الخاصة بك (ختم / تميز / مشاركة). يمكنك تحديد إحداثيات موضع الاسم لطباعته لاحقاً. إذا كان لديك النموذج جاهز أرسله وسأربطه هنا.
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as CertType)}>
          <TabsList>
            {(Object.keys(TYPE_LABEL) as CertType[]).map((k) => (
              <TabsTrigger key={k} value={k}>{TYPE_LABEL[k]}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="space-y-4">
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold">قوالب {TYPE_LABEL[tab]}</h2>
                <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1"><Upload className="h-4 w-4" /> رفع قالب PDF</Button>
              </div>
              {tabTemplates.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">لا توجد قوالب مرفوعة. ارفع قالب PDF لبدء إصدار الشهادات.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-right"><th className="p-1">الاسم</th><th className="p-1">X</th><th className="p-1">Y</th><th className="p-1">حجم الخط</th><th></th></tr></thead>
                  <tbody>
                    {tabTemplates.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="p-1 font-semibold">{t.label}</td>
                        <td className="p-1">{t.name_x}</td>
                        <td className="p-1">{t.name_y}</td>
                        <td className="p-1">{t.font_size}</td>
                        <td className="p-1 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => downloadTemplate(t)}>معاينة</Button>
                          <Button size="sm" variant="ghost" onClick={() => delTemplate(t)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold">سجل {TYPE_LABEL[tab]} — {year}هـ ({tabIssued.length})</h2>
                <Button size="sm" onClick={() => setIssueOpen(true)} className="gap-1"><Printer className="h-4 w-4" /> إصدار شهادات</Button>
              </div>
              {tabIssued.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">لم يُصدر شيء بعد لهذا العام.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-right"><th className="p-1">#</th><th className="p-1">الاسم</th><th className="p-1">تاريخ الإصدار</th><th></th></tr></thead>
                  <tbody>
                    {tabIssued.map((i, idx) => (
                      <tr key={i.id} className="border-t border-border">
                        <td className="p-1">{idx + 1}</td>
                        <td className="p-1 font-semibold">{i.recipient_name}</td>
                        <td className="p-1 text-muted-foreground">{new Date(i.created_at).toLocaleDateString('ar-EG')}</td>
                        <td className="p-1"><Button size="sm" variant="ghost" onClick={() => delIssued(i.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>رفع قالب — {TYPE_LABEL[tab]}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">اسم القالب</label><Input value={uploadForm.label} onChange={(e) => setUploadForm({ ...uploadForm, label: e.target.value })} placeholder="مثال: شهادة ختم 1447" /></div>
            <div><label className="text-sm">ملف PDF *</label><Input type="file" accept="application/pdf" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-sm">X</label><Input type="number" value={uploadForm.name_x} onChange={(e) => setUploadForm({ ...uploadForm, name_x: e.target.value })} /></div>
              <div><label className="text-sm">Y</label><Input type="number" value={uploadForm.name_y} onChange={(e) => setUploadForm({ ...uploadForm, name_y: e.target.value })} /></div>
              <div><label className="text-sm">حجم الخط</label><Input type="number" value={uploadForm.font_size} onChange={(e) => setUploadForm({ ...uploadForm, font_size: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">إحداثيات موضع الاسم على القالب (تُستخدم لاحقاً عند دمج الأسماء على PDF).</p>
          </div>
          <DialogFooter><Button onClick={uploadTemplate}>رفع</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إصدار {TYPE_LABEL[tab]} — {year}هـ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {tabTemplates.length > 0 && (
              <div><label className="text-sm">القالب (اختياري)</label>
                <Select value={issueForm.template_id} onValueChange={(v) => setIssueForm({ ...issueForm, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="بدون قالب" /></SelectTrigger>
                  <SelectContent>{tabTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><label className="text-sm">الأسماء (كل اسم في سطر أو مفصولة بفواصل)</label>
              <Textarea rows={8} value={issueForm.names} onChange={(e) => setIssueForm({ ...issueForm, names: e.target.value })} placeholder="أحمد محمد&#10;فاطمة علي&#10;..." />
            </div>
          </div>
          <DialogFooter><Button onClick={issue}>تسجيل</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
