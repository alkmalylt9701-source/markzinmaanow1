import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Plus, Pencil, Trash2, Heart, FileText, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "الرعاة والممولون - المسابقة الرمضانية" },
      { name: "description", content: "إدارة رعاة وممولي المسابقة الرمضانية ومساهماتهم النقدية والعينية." },
      { property: "og:title", content: "الرعاة والممولون" },
      { property: "og:description", content: "إدارة رعاة وممولي المسابقة الرمضانية." },
    ],
  }),
  component: SponsorsPage,
});

interface Sponsor {
  id: string;
  name: string;
  sponsor_type: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface Contribution {
  id: string;
  sponsor_id: string;
  year: string;
  cash_amount: number;
  in_kind_description: string | null;
  in_kind_value: number;
  sponsorship_areas: string[];
  notes: string | null;
}

const SPONSORSHIP_AREAS = [
  "إكراميات المعلمات",
  "إكراميات الطلاب",
  "الأيتام والمساكين",
  "مستلزمات الحفل",
  "الشهادات والدروع",
  "الضيافة",
  "رعاية عامة",
];

function SponsorsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [contribs, setContribs] = useState<Record<string, Contribution | null>>({});
  const [loading, setLoading] = useState(true);
  const [openSponsor, setOpenSponsor] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [sForm, setSForm] = useState({ name: "", sponsor_type: "individual", phone: "", email: "", notes: "" });
  const [openContrib, setOpenContrib] = useState<Sponsor | null>(null);
  const [cForm, setCForm] = useState({ cash_amount: "0", in_kind_description: "", in_kind_value: "0", sponsorship_areas: [] as string[], notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: sps } = await supabase.from("sponsors").select("*").eq("user_id", user.id).order("name");
    const list = (sps || []) as Sponsor[];
    setSponsors(list);
    const { data: cs } = await supabase.from("sponsor_contributions").select("*").eq("user_id", user.id).eq("year", year);
    const map: Record<string, Contribution | null> = {};
    list.forEach((s) => (map[s.id] = null));
    (cs || []).forEach((c) => { map[c.sponsor_id] = c as Contribution; });
    setContribs(map);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleYear = async (y: string) => { setYear(y); await setActiveYear(y); };

  const openNewSponsor = () => { setEditing(null); setSForm({ name: "", sponsor_type: "individual", phone: "", email: "", notes: "" }); setOpenSponsor(true); };
  const openEditSponsor = (s: Sponsor) => { setEditing(s); setSForm({ name: s.name, sponsor_type: s.sponsor_type, phone: s.phone || "", email: s.email || "", notes: s.notes || "" }); setOpenSponsor(true); };

  const saveSponsor = async () => {
    if (!user || !sForm.name.trim()) { toast.error("أدخل اسم الراعي"); return; }
    if (editing) {
      const { error } = await supabase.from("sponsors").update({ name: sForm.name.trim(), sponsor_type: sForm.sponsor_type, phone: sForm.phone || null, email: sForm.email || null, notes: sForm.notes || null }).eq("id", editing.id);
      if (error) { toast.error("فشل التعديل"); return; }
    } else {
      const { error } = await supabase.from("sponsors").insert({ user_id: user.id, name: sForm.name.trim(), sponsor_type: sForm.sponsor_type, phone: sForm.phone || null, email: sForm.email || null, notes: sForm.notes || null });
      if (error) { toast.error("فشل الإضافة"); return; }
    }
    toast.success("تم الحفظ");
    setOpenSponsor(false);
    loadData();
  };

  const removeSponsor = async (s: Sponsor) => {
    if (!confirm(`حذف الراعي "${s.name}" وكل مساهماته؟`)) return;
    await supabase.from("sponsor_contributions").delete().eq("sponsor_id", s.id);
    const { error } = await supabase.from("sponsors").delete().eq("id", s.id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    loadData();
  };

  const openContribFor = (s: Sponsor) => {
    const c = contribs[s.id];
    setCForm({
      cash_amount: c ? String(c.cash_amount) : "0",
      in_kind_description: c?.in_kind_description || "",
      in_kind_value: c ? String(c.in_kind_value) : "0",
      sponsorship_areas: c?.sponsorship_areas || [],
      notes: c?.notes || "",
    });
    setOpenContrib(s);
  };

  const saveContrib = async () => {
    if (!user || !openContrib) return;
    const existing = contribs[openContrib.id];
    const payload = {
      user_id: user.id,
      sponsor_id: openContrib.id,
      year,
      cash_amount: Number(cForm.cash_amount) || 0,
      in_kind_description: cForm.in_kind_description || null,
      in_kind_value: Number(cForm.in_kind_value) || 0,
      sponsorship_areas: cForm.sponsorship_areas,
      notes: cForm.notes || null,
    };
    if (existing) {
      const { error } = await supabase.from("sponsor_contributions").update(payload).eq("id", existing.id);
      if (error) { toast.error("فشل الحفظ"); return; }
    } else {
      const { error } = await supabase.from("sponsor_contributions").insert(payload);
      if (error) { toast.error("فشل الحفظ"); return; }
    }
    toast.success("تم حفظ المساهمة");
    setOpenContrib(null);
    loadData();
  };

  const toggleArea = (a: string) => {
    setCForm((p) => ({ ...p, sponsorship_areas: p.sponsorship_areas.includes(a) ? p.sponsorship_areas.filter((x) => x !== a) : [...p.sponsorship_areas, a] }));
  };

  const totalCash = Object.values(contribs).reduce((s, c) => s + (c?.cash_amount || 0), 0);
  const totalInKind = Object.values(contribs).reduce((s, c) => s + (c?.in_kind_value || 0), 0);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="شعار" className="h-12 w-12 rounded-full bg-white p-1" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">الرعاة والممولون</h1>
            <p className="text-sm opacity-90">إدارة فاعلي الخير ومساهماتهم السنوية</p>
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
            <span className="font-semibold">سنة الحفل:</span>
            <Select value={year} onValueChange={handleYear}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNewSponsor} className="gap-2"><Plus className="h-4 w-4" /> إضافة راعٍ</Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/sponsors/report" search={{ year }}><FileText className="h-4 w-4" /> تقرير قابل للطباعة</Link>
          </Button>
          <div className="mr-auto text-sm space-y-1">
            <div>إجمالي النقدي: <span className="font-bold text-primary">{totalCash.toLocaleString("ar-SA")} ر.س</span></div>
            <div>إجمالي العيني: <span className="font-bold text-primary">{totalInKind.toLocaleString("ar-SA")} ر.س</span></div>
          </div>
        </div>

        {loading ? <div className="text-center py-10">جارٍ التحميل...</div> : sponsors.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">لا يوجد رعاة بعد. ابدئي بإضافة أول راعٍ.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sponsors.map((s) => {
              const c = contribs[s.id];
              const hasContrib = c && (c.cash_amount > 0 || c.in_kind_value > 0);
              return (
                <div key={s.id} className="bg-card border rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {s.sponsor_type === "individual" ? "فرد" : s.sponsor_type === "company" ? "شركة" : "مؤسسة خيرية"}
                        {s.phone && <> • {s.phone}</>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditSponsor(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeSponsor(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>

                  <div className={`rounded-md p-3 text-sm ${hasContrib ? "bg-primary/5 border border-primary/20" : "bg-muted/40"}`}>
                    {hasContrib ? (
                      <>
                        <div className="flex justify-between mb-1"><span>نقدي:</span><span className="font-bold">{c!.cash_amount.toLocaleString("ar-SA")} ر.س</span></div>
                        {c!.in_kind_value > 0 && <div className="flex justify-between mb-1"><span>عيني:</span><span className="font-bold">{c!.in_kind_value.toLocaleString("ar-SA")} ر.س</span></div>}
                        {c!.in_kind_description && <div className="text-xs text-muted-foreground mt-1">📦 {c!.in_kind_description}</div>}
                        {c!.sponsorship_areas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c!.sponsorship_areas.map((a) => <span key={a} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a}</span>)}
                          </div>
                        )}
                      </>
                    ) : <p className="text-muted-foreground text-center">لم تسجل مساهمة لسنة {year}هـ</p>}
                  </div>

                  <Button size="sm" variant="outline" className="w-full mt-2 gap-1" onClick={() => openContribFor(s)}>
                    <Heart className="h-3 w-3" /> {hasContrib ? "تعديل المساهمة" : "تسجيل مساهمة"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog: إضافة/تعديل راعٍ */}
      <Dialog open={openSponsor} onOpenChange={setOpenSponsor}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل راعٍ" : "إضافة راعٍ جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm mb-1 block">الاسم *</label><Input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} /></div>
            <div>
              <label className="text-sm mb-1 block">النوع</label>
              <Select value={sForm.sponsor_type} onValueChange={(v) => setSForm({ ...sForm, sponsor_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">فرد</SelectItem>
                  <SelectItem value="company">شركة</SelectItem>
                  <SelectItem value="charity">مؤسسة خيرية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm mb-1 block">الجوال</label><Input value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} /></div>
            <div><label className="text-sm mb-1 block">البريد</label><Input type="email" value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} /></div>
            <div><label className="text-sm mb-1 block">ملاحظات</label><Textarea value={sForm.notes} onChange={(e) => setSForm({ ...sForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveSponsor}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: مساهمة */}
      <Dialog open={!!openContrib} onOpenChange={(o) => !o && setOpenContrib(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مساهمة {openContrib?.name} - {year}هـ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm mb-1 block">المبلغ النقدي (ر.س)</label>
              <Input type="number" value={cForm.cash_amount} onChange={(e) => setCForm({ ...cForm, cash_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-sm mb-1 block">وصف المساهمة العينية</label>
              <Textarea placeholder="مثال: 50 سلة رمضانية، هدايا، أدوات ضيافة..." value={cForm.in_kind_description} onChange={(e) => setCForm({ ...cForm, in_kind_description: e.target.value })} />
            </div>
            <div>
              <label className="text-sm mb-1 block">القيمة التقديرية للعيني (ر.س)</label>
              <Input type="number" value={cForm.in_kind_value} onChange={(e) => setCForm({ ...cForm, in_kind_value: e.target.value })} />
            </div>
            <div>
              <label className="text-sm mb-2 block">مجالات الرعاية</label>
              <div className="grid grid-cols-2 gap-2">
                {SPONSORSHIP_AREAS.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={cForm.sponsorship_areas.includes(a)} onCheckedChange={() => toggleArea(a)} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div><label className="text-sm mb-1 block">ملاحظات</label><Textarea value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveContrib}>حفظ المساهمة</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
