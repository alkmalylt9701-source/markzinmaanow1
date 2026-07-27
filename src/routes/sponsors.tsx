import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Plus, Pencil, Trash2, Calendar, FileText, ChevronDown, ChevronLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/sponsors")({
  head: () => ({ meta: [
    { title: "الممولون وفاعلو الخير" },
    { name: "description", content: "سجل ممولي ورعاة الحفل الرمضاني السنوي وتقارير التبرعات" },
  ]}),
  component: SponsorsPage,
});

interface Sponsor { id: string; name: string; sponsor_type: "individual"|"company"; phone: string|null; email: string|null; notes: string|null; }
interface Contribution { id: string; sponsor_id: string; year: string; cash_amount: number; in_kind_description: string|null; in_kind_value: number; sponsorship_areas: string[]; notes: string|null; }

const AREAS: { value: string; label: string }[] = [
  { value: "ceremony", label: "مصروفات الحفل" },
  { value: "teachers", label: "إكرامية المعلمين" },
  { value: "students", label: "إكرامية الطلاب" },
  { value: "orphans", label: "إكرامية الأيتام" },
  { value: "needy", label: "إكرامية الأسر" },
  { value: "certificates", label: "الشهادات" },
  { value: "other", label: "أخرى" },
];
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label]));

function SponsorsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [sponsorForm, setSponsorForm] = useState({ name: "", sponsor_type: "individual" as "individual"|"company", phone: "", email: "", notes: "" });

  const [contribOpen, setContribOpen] = useState(false);
  const [contribSponsor, setContribSponsor] = useState<Sponsor | null>(null);
  const [editingContrib, setEditingContrib] = useState<Contribution | null>(null);
  const [contribForm, setContribForm] = useState({ cash_amount: "0", in_kind_description: "", in_kind_value: "0", sponsorship_areas: [] as string[], notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const [sRes, cRes] = await Promise.all([
      supabase.from("sponsors").select("*").eq("user_id", user.id).order("name"),
      supabase.from("sponsor_contributions").select("*").eq("user_id", user.id).eq("year", year),
    ]);
    setSponsors((sRes.data || []) as Sponsor[]);
    setContribs((cRes.data || []) as Contribution[]);
  }, [user, year]);
  useEffect(() => { load(); }, [load]);

  const contribBySponsor = useMemo(() => {
    const map = new Map<string, Contribution[]>();
    contribs.forEach((c) => { const arr = map.get(c.sponsor_id) || []; arr.push(c); map.set(c.sponsor_id, arr); });
    return map;
  }, [contribs]);

  const yearTotals = useMemo(() => {
    const cash = contribs.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
    const inkind = contribs.reduce((s, r) => s + Number(r.in_kind_value || 0), 0);
    return { cash, inkind, total: cash + inkind, count: new Set(contribs.map((c) => c.sponsor_id)).size };
  }, [contribs]);

  const openNewSponsor = () => { setEditingSponsor(null); setSponsorForm({ name: "", sponsor_type: "individual", phone: "", email: "", notes: "" }); setSponsorOpen(true); };
  const openEditSponsor = (s: Sponsor) => { setEditingSponsor(s); setSponsorForm({ name: s.name, sponsor_type: s.sponsor_type, phone: s.phone || "", email: s.email || "", notes: s.notes || "" }); setSponsorOpen(true); };

  const saveSponsor = async () => {
    if (!user || !sponsorForm.name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (editingSponsor) await supabase.from("sponsors").update(sponsorForm).eq("id", editingSponsor.id);
    else await supabase.from("sponsors").insert({ user_id: user.id, ...sponsorForm });
    toast.success("تم الحفظ"); setSponsorOpen(false); load();
  };

  const delSponsor = async (id: string) => {
    if (!confirm("حذف الممول وجميع مساهماته؟")) return;
    await supabase.from("sponsors").delete().eq("id", id);
    load();
  };

  const openNewContrib = (sponsor: Sponsor) => {
    setContribSponsor(sponsor); setEditingContrib(null);
    setContribForm({ cash_amount: "0", in_kind_description: "", in_kind_value: "0", sponsorship_areas: [], notes: "" });
    setContribOpen(true);
  };
  const openEditContrib = (sponsor: Sponsor, c: Contribution) => {
    setContribSponsor(sponsor); setEditingContrib(c);
    setContribForm({ cash_amount: String(c.cash_amount), in_kind_description: c.in_kind_description || "", in_kind_value: String(c.in_kind_value), sponsorship_areas: c.sponsorship_areas || [], notes: c.notes || "" });
    setContribOpen(true);
  };

  const saveContrib = async () => {
    if (!user || !contribSponsor) return;
    const payload = {
      cash_amount: Number(contribForm.cash_amount) || 0,
      in_kind_description: contribForm.in_kind_description || null,
      in_kind_value: Number(contribForm.in_kind_value) || 0,
      sponsorship_areas: contribForm.sponsorship_areas,
      notes: contribForm.notes || null,
    };
    if (editingContrib) await supabase.from("sponsor_contributions").update(payload).eq("id", editingContrib.id);
    else await supabase.from("sponsor_contributions").insert({ user_id: user.id, sponsor_id: contribSponsor.id, year, ...payload });
    toast.success("تم الحفظ"); setContribOpen(false); load();
  };

  const delContrib = async (id: string) => {
    if (!confirm("حذف هذه المساهمة؟")) return;
    await supabase.from("sponsor_contributions").delete().eq("id", id);
    load();
  };

  const toggleArea = (a: string) => {
    setContribForm((p) => ({ ...p, sponsorship_areas: p.sponsorship_areas.includes(a) ? p.sponsorship_areas.filter((x) => x !== a) : [...p.sponsorship_areas, a] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const printReport = async (sponsor: Sponsor) => {
    if (!user) return;
    const list = contribBySponsor.get(sponsor.id) || [];
    if (list.length === 0) { toast.error("لا توجد مساهمات لهذا الممول في عام " + year); return; }
    const areas = new Set<string>(); list.forEach((c) => c.sponsorship_areas.forEach((a) => areas.add(a)));

    // pull details relevant to sponsored areas
    const [hRes, eRes] = await Promise.all([
      supabase.from("honorariums").select("*").eq("user_id", user.id).eq("year", year),
      supabase.from("ceremony_expenses").select("*").eq("user_id", user.id).eq("year", year),
    ]);
    const honor = (hRes.data || []) as { recipient_kind: string; recipient_name: string; cash_amount: number; in_kind_description: string|null; in_kind_value: number }[];
    const expenses = (eRes.data || []) as { item: string; category: string|null; cash_amount: number; in_kind_description: string|null; in_kind_value: number; supplier: string|null }[];

    const cash = list.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
    const inkind = list.reduce((s, r) => s + Number(r.in_kind_value || 0), 0);

    const esc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const areaToKind: Record<string, string> = { teachers: "teacher", students: "student", orphans: "orphan", needy: "needy" };

    const sections: string[] = [];
    for (const a of areas) {
      if (a === "ceremony") {
        const rows = expenses.map((e) => `<tr><td>${esc(e.item)}</td><td>${esc(e.category||'-')}</td><td>${esc(e.supplier||'-')}</td><td>${Number(e.cash_amount).toLocaleString()}</td><td>${esc(e.in_kind_description||'-')}</td><td>${Number(e.in_kind_value).toLocaleString()}</td></tr>`).join('');
        sections.push(`<h3>تفاصيل مصروفات الحفل</h3><table><thead><tr><th>البند</th><th>التصنيف</th><th>المورد</th><th>نقدي</th><th>عيني</th><th>قيمة العيني</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لا توجد بنود</td></tr>'}</tbody></table>`);
      } else if (areaToKind[a]) {
        const kind = areaToKind[a];
        const rows = honor.filter((h) => h.recipient_kind === kind).map((h) => `<tr><td>${esc(h.recipient_name)}</td><td>${Number(h.cash_amount).toLocaleString()}</td><td>${esc(h.in_kind_description||'-')}</td><td>${Number(h.in_kind_value).toLocaleString()}</td></tr>`).join('');
        sections.push(`<h3>${esc(AREA_LABEL[a])}</h3><table><thead><tr><th>المستفيد</th><th>نقدي</th><th>عيني</th><th>قيمة العيني</th></tr></thead><tbody>${rows || '<tr><td colspan="4">لا توجد بيانات</td></tr>'}</tbody></table>`);
      }
    }

    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>تقرير الممول ${esc(sponsor.name)} - ${year}هـ</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Tajawal,'Segoe UI',Tahoma,sans-serif;padding:20px;color:#1a3a2a}
        .header{text-align:center;border-bottom:3px solid #2d7a52;padding-bottom:16px;margin-bottom:20px}
        .header img{height:80px;margin-bottom:8px}
        .header h1{font-size:20px;color:#2d7a52}
        .header h2{font-size:15px;color:#555;margin-top:4px}
        .info{background:#f0f7f3;padding:12px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
        .info strong{color:#2d7a52}
        .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}
        .tbox{background:#f0f7f3;border:2px solid #2d7a52;padding:12px;border-radius:8px;text-align:center}
        .tbox .n{font-size:20px;font-weight:bold;color:#2d7a52}
        table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:12px}
        th{background:#2d7a52;color:#fff;padding:6px;border:1px solid #1a5a38}
        td{padding:6px;border:1px solid #ccc;text-align:center}
        tr:nth-child(even){background:#f9fdfb}
        h3{color:#2d7a52;margin-top:16px;border-right:4px solid #2d7a52;padding-right:8px}
        .thanks{margin-top:24px;padding:16px;background:#fdf6e3;border-radius:8px;border-right:4px solid #b8860b;font-size:14px;line-height:1.8}
        .footer{text-align:center;margin-top:24px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:10px}
        @media print{body{padding:10px}}
      </style></head><body>
      <div class="header">
        <img src="${logo}" />
        <h1>مركز إنماء الأهلي الخيري</h1>
        <h2>تقرير المموّل الكريم عن العام ${year}هـ</h2>
      </div>
      <div class="info">
        <div><strong>اسم الممول:</strong> ${esc(sponsor.name)}</div>
        <div><strong>الصفة:</strong> ${sponsor.sponsor_type === 'company' ? 'شركة/مؤسسة' : 'فرد'}</div>
        ${sponsor.phone ? `<div><strong>الجوال:</strong> ${esc(sponsor.phone)}</div>` : ''}
      </div>
      <h3>ملخص التبرع</h3>
      <div class="totals">
        <div class="tbox"><div>نقدي</div><div class="n">${cash.toLocaleString()}</div></div>
        <div class="tbox"><div>عيني (تقدير)</div><div class="n">${inkind.toLocaleString()}</div></div>
        <div class="tbox"><div>الإجمالي</div><div class="n">${(cash+inkind).toLocaleString()}</div></div>
      </div>
      <h3>تفاصيل المساهمات</h3>
      <table><thead><tr><th>نقدي</th><th>وصف العيني</th><th>قيمة العيني</th><th>جهات الرعاية</th><th>ملاحظات</th></tr></thead><tbody>
        ${list.map((c) => `<tr><td>${Number(c.cash_amount).toLocaleString()}</td><td>${esc(c.in_kind_description||'-')}</td><td>${Number(c.in_kind_value).toLocaleString()}</td><td>${c.sponsorship_areas.map((a) => esc(AREA_LABEL[a]||a)).join('، ')||'-'}</td><td>${esc(c.notes||'-')}</td></tr>`).join('')}
      </tbody></table>
      ${sections.join('')}
      <div class="thanks">
        <p><strong>خطاب شكر وتقدير</strong></p>
        <p>يتقدم مركز إنماء الأهلي الخيري بجزيل الشكر وعظيم الامتنان إلى ${esc(sponsor.name)} على كريم دعمه ومساهمته في إنجاح فعاليات المسابقة الرمضانية للعام ${year}هـ.</p>
        <p>سائلين المولى عز وجل أن يجعل ذلك في موازين حسناتكم، وأن يبارك لكم في أهلكم ومالكم، وأن يجزيكم عنا وعن طلابنا وطالباتنا خير الجزاء.</p>
        <p style="text-align:left;margin-top:12px"><strong>إدارة مركز إنماء الأهلي الخيري</strong><br/>الإشراف - شرعب الرونة</p>
      </div>
      <div class="footer">تم إصدار التقرير بتاريخ ${new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'})}</div>
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">الممولون وفاعلو الخير</h1>
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
          <Button onClick={openNewSponsor} className="gap-2"><Plus className="h-4 w-4" /> إضافة ممول</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">عدد الممولين لهذا العام</div><div className="text-lg font-bold">{yearTotals.count}</div></div>
          <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">مجموع النقدي</div><div className="text-lg font-bold">{yearTotals.cash.toLocaleString()}</div></div>
          <div className="bg-card p-3 rounded-md border text-center"><div className="text-xs text-muted-foreground">مجموع العينيات</div><div className="text-lg font-bold">{yearTotals.inkind.toLocaleString()}</div></div>
          <div className="bg-primary/10 p-3 rounded-md border-2 border-primary text-center"><div className="text-xs text-primary">إجمالي الدعم</div><div className="text-lg font-bold text-primary">{yearTotals.total.toLocaleString()}</div></div>
        </div>

        <div className="space-y-2">
          {sponsors.length === 0 ? (
            <div className="bg-card p-6 rounded-md border text-center text-muted-foreground">لا يوجد ممولون بعد. أضف أول ممول.</div>
          ) : sponsors.map((s) => {
            const list = contribBySponsor.get(s.id) || [];
            const cash = list.reduce((a, c) => a + Number(c.cash_amount || 0), 0);
            const inkind = list.reduce((a, c) => a + Number(c.in_kind_value || 0), 0);
            const isOpen = expanded.has(s.id);
            return (
              <div key={s.id} className="bg-card rounded-lg border border-border">
                <div className="p-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleExpand(s.id)}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{s.name} <span className="text-xs text-muted-foreground">({s.sponsor_type === 'company' ? 'شركة' : 'فرد'})</span></div>
                    <div className="text-xs text-muted-foreground">{s.phone || '-'} {s.email ? `· ${s.email}` : ''}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">نقدي:</span> <span className="font-bold">{cash.toLocaleString()}</span>
                    <span className="text-muted-foreground mr-2">عيني:</span> <span className="font-bold">{inkind.toLocaleString()}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openNewContrib(s)} className="gap-1"><Plus className="h-3 w-3" /> مساهمة</Button>
                  <Button size="sm" variant="secondary" onClick={() => printReport(s)} className="gap-1"><Printer className="h-3 w-3" /> تقرير</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditSponsor(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => delSponsor(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
                {isOpen && (
                  <div className="border-t border-border p-3 bg-muted/30">
                    <div className="text-sm font-semibold mb-2">مساهمات عام {year}هـ</div>
                    {list.length === 0 ? (
                      <div className="text-sm text-muted-foreground">لا توجد مساهمات مسجلة لهذا العام.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead><tr className="text-right">
                          <th className="p-1">نقدي</th><th className="p-1">وصف العيني</th><th className="p-1">قيمة العيني</th><th className="p-1">جهات الرعاية</th><th className="p-1">ملاحظات</th><th></th>
                        </tr></thead>
                        <tbody>
                          {list.map((c) => (
                            <tr key={c.id} className="border-t border-border/60">
                              <td className="p-1">{Number(c.cash_amount).toLocaleString()}</td>
                              <td className="p-1">{c.in_kind_description || '-'}</td>
                              <td className="p-1">{Number(c.in_kind_value).toLocaleString()}</td>
                              <td className="p-1">{c.sponsorship_areas.map((a) => AREA_LABEL[a] || a).join('، ') || '-'}</td>
                              <td className="p-1 text-muted-foreground">{c.notes || '-'}</td>
                              <td className="p-1 flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEditContrib(s, c)}><Pencil className="h-3 w-3" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => delContrib(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sponsor dialog */}
      <Dialog open={sponsorOpen} onOpenChange={setSponsorOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingSponsor ? "تعديل ممول" : "إضافة ممول جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">الاسم *</label><Input value={sponsorForm.name} onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })} /></div>
            <div><label className="text-sm">الصفة</label>
              <Select value={sponsorForm.sponsor_type} onValueChange={(v) => setSponsorForm({ ...sponsorForm, sponsor_type: v as "individual"|"company" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="individual">فرد</SelectItem><SelectItem value="company">شركة/مؤسسة</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm">الجوال</label><Input value={sponsorForm.phone} onChange={(e) => setSponsorForm({ ...sponsorForm, phone: e.target.value })} /></div>
              <div><label className="text-sm">البريد</label><Input value={sponsorForm.email} onChange={(e) => setSponsorForm({ ...sponsorForm, email: e.target.value })} /></div>
            </div>
            <div><label className="text-sm">ملاحظات</label><Textarea value={sponsorForm.notes} onChange={(e) => setSponsorForm({ ...sponsorForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveSponsor}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribution dialog */}
      <Dialog open={contribOpen} onOpenChange={setContribOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingContrib ? "تعديل مساهمة" : `مساهمة جديدة - ${contribSponsor?.name} - ${year}هـ`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-sm">مبلغ نقدي</label><Input type="number" value={contribForm.cash_amount} onChange={(e) => setContribForm({ ...contribForm, cash_amount: e.target.value })} /></div>
              <div><label className="text-sm">قيمة العيني</label><Input type="number" value={contribForm.in_kind_value} onChange={(e) => setContribForm({ ...contribForm, in_kind_value: e.target.value })} /></div>
            </div>
            <div><label className="text-sm">وصف العيني</label><Input value={contribForm.in_kind_description} onChange={(e) => setContribForm({ ...contribForm, in_kind_description: e.target.value })} /></div>
            <div>
              <label className="text-sm">جهات الرعاية (اختر ما ينطبق)</label>
              <div className="grid grid-cols-2 gap-2 mt-1 p-2 border rounded-md">
                {AREAS.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={contribForm.sponsorship_areas.includes(a.value)} onCheckedChange={() => toggleArea(a.value)} />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
            <div><label className="text-sm">ملاحظات</label><Textarea value={contribForm.notes} onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveContrib}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
