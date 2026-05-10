import { createFileRoute, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Save, Gift, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { START_YEAR, END_YEAR } from "@/types/student";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/teachers/$teacherId")({
  component: TeacherBonusPage,
});

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

interface Teacher { id: string; name: string; phone: string | null; }
interface MonthlyRow { month: number; amount: string; notes: string; id?: string; }

function TeacherBonusPage() {
  const { teacherId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [year, setYear] = useState("1447");
  const [monthly, setMonthly] = useState<MonthlyRow[]>(
    HIJRI_MONTHS.map((_, i) => ({ month: i + 1, amount: "", notes: "" }))
  );
  const [annual, setAnnual] = useState({
    cash_amount: "", in_kind_description: "", in_kind_value: "", notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, mRes, aRes] = await Promise.all([
      supabase.from("teachers").select("*").eq("id", teacherId).eq("user_id", user.id).maybeSingle(),
      supabase.from("teacher_monthly_bonuses").select("*").eq("teacher_id", teacherId).eq("year", year),
      supabase.from("teacher_annual_bonuses").select("*").eq("teacher_id", teacherId).eq("year", year).maybeSingle(),
    ]);
    if (!tRes.data) { toast.error("المعلمة غير موجودة"); navigate({ to: "/teachers" }); return; }
    setTeacher(tRes.data as Teacher);

    const mMap = new Map<number, any>();
    (mRes.data || []).forEach((r: any) => mMap.set(r.month, r));
    setMonthly(HIJRI_MONTHS.map((_, i) => {
      const m = i + 1;
      const r = mMap.get(m);
      return {
        month: m,
        amount: r?.amount?.toString() || "",
        notes: r?.notes || "",
        id: r?.id,
      };
    }));

    if (aRes.data) {
      setAnnual({
        cash_amount: aRes.data.cash_amount?.toString() || "",
        in_kind_description: aRes.data.in_kind_description || "",
        in_kind_value: aRes.data.in_kind_value?.toString() || "",
        notes: aRes.data.notes || "",
      });
    } else {
      setAnnual({ cash_amount: "", in_kind_description: "", in_kind_value: "", notes: "" });
    }
    setLoading(false);
  }, [user, teacherId, year, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleYearChange = async (y: string) => {
    setYear(y);
    await setActiveYear(y);
  };

  const updateMonth = (idx: number, patch: Partial<MonthlyRow>) => {
    setMonthly((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const saveMonthly = async () => {
    if (!user) return;
    setSaving(true);
    const rows = monthly
      .filter((r) => r.amount.trim() || r.notes.trim())
      .map((r) => ({
        user_id: user.id,
        teacher_id: teacherId,
        year,
        month: r.month,
        amount: parseFloat(r.amount) || 0,
        notes: r.notes.trim() || null,
      }));
    // حذف الأشهر الفارغة
    const emptyMonths = monthly.filter((r) => !r.amount.trim() && !r.notes.trim() && r.id).map((r) => r.month);
    if (emptyMonths.length > 0) {
      await supabase.from("teacher_monthly_bonuses").delete()
        .eq("teacher_id", teacherId).eq("year", year).in("month", emptyMonths);
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("teacher_monthly_bonuses").upsert(rows, { onConflict: "teacher_id,year,month" });
      if (error) { toast.error("فشل حفظ الإكراميات الشهرية"); setSaving(false); return; }
    }
    toast.success("تم حفظ الإكراميات الشهرية");
    setSaving(false);
    await load();
  };

  const saveAnnual = async () => {
    if (!user) return;
    const cash = parseFloat(annual.cash_amount) || 0;
    const inKindVal = parseFloat(annual.in_kind_value) || 0;
    if (cash === 0 && inKindVal === 0 && !annual.in_kind_description.trim()) {
      // حذف السجل إن كان فارغاً
      await supabase.from("teacher_annual_bonuses").delete().eq("teacher_id", teacherId).eq("year", year);
      toast.success("تم تفريغ الإكرامية السنوية");
      return;
    }
    const { error } = await supabase.from("teacher_annual_bonuses").upsert({
      user_id: user.id,
      teacher_id: teacherId,
      year,
      cash_amount: cash,
      in_kind_description: annual.in_kind_description.trim() || null,
      in_kind_value: inKindVal,
      notes: annual.notes.trim() || null,
    }, { onConflict: "teacher_id,year" });
    if (error) { toast.error("فشل حفظ الإكرامية السنوية"); return; }
    toast.success("تم حفظ الإكرامية السنوية");
    await load();
  };

  if (authLoading || !user || loading || !teacher) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جارٍ التحميل...</div>;
  }

  const totalMonthly = monthly.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalAnnual = (parseFloat(annual.cash_amount) || 0) + (parseFloat(annual.in_kind_value) || 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary via-primary to-primary/90 text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="الشعار" className="h-14 w-auto" />
            <div>
              <h1 className="text-xl font-bold">إكراميات: {teacher.name}</h1>
              <div className="text-sm text-primary-foreground/85">الإكرامية الشهرية والسنوية</div>
            </div>
          </div>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/teachers"><ArrowRight className="h-4 w-4" /> رجوع للمعلمات</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">السنة:</span>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger className="w-32 bg-background font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mr-auto text-sm">
            <span className="text-muted-foreground">إجمالي الشهرية: </span>
            <span className="font-bold text-primary">{totalMonthly.toLocaleString()} ر.س</span>
            <span className="mx-3 text-muted-foreground">|</span>
            <span className="text-muted-foreground">السنوية: </span>
            <span className="font-bold text-primary">{totalAnnual.toLocaleString()} ر.س</span>
          </div>
        </div>

        {/* الإكراميات الشهرية */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="font-bold text-primary flex items-center gap-2">
              <Gift className="h-5 w-5" /> الإكرامية الشهرية
            </div>
            <Button onClick={saveMonthly} disabled={saving} size="sm" className="gap-2">
              <Save className="h-4 w-4" /> حفظ الشهرية
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">الشهر</th>
                  <th className="px-3 py-2 text-right font-semibold w-40">المبلغ (ر.س)</th>
                  <th className="px-3 py-2 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((r, i) => (
                  <tr key={r.month} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-semibold">
                      {HIJRI_MONTHS[i]}
                      {r.month === 9 && <span className="mr-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">رمضان</span>}
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        type="number" value={r.amount}
                        onChange={(e) => updateMonth(i, { amount: e.target.value })}
                        placeholder="0" className="h-8"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <Input
                        value={r.notes}
                        onChange={(e) => updateMonth(i, { notes: e.target.value })}
                        placeholder="اختياري" className="h-8" maxLength={200}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* الإكرامية السنوية - تظهر دائماً مع تنبيه عند نهاية رمضان */}
        <div className="bg-card border-2 border-primary/40 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-primary/15 border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="font-bold text-primary flex items-center gap-2">
              🎁 الإكرامية السنوية (نهاية رمضان)
            </div>
            <Button onClick={saveAnnual} size="sm" className="gap-2">
              <Save className="h-4 w-4" /> حفظ السنوية
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <label className="text-sm font-bold text-primary">💵 إكرامية نقدية</label>
                <Input
                  type="number" value={annual.cash_amount}
                  onChange={(e) => setAnnual({ ...annual, cash_amount: e.target.value })}
                  placeholder="المبلغ بالريال"
                />
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <label className="text-sm font-bold text-primary">🎀 إكرامية عينية</label>
                <Input
                  value={annual.in_kind_description}
                  onChange={(e) => setAnnual({ ...annual, in_kind_description: e.target.value })}
                  placeholder="وصف الهدية العينية" maxLength={300}
                />
                <Input
                  type="number" value={annual.in_kind_value}
                  onChange={(e) => setAnnual({ ...annual, in_kind_value: e.target.value })}
                  placeholder="القيمة التقديرية (ر.س)"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">ملاحظات السنوية</label>
              <Textarea
                value={annual.notes}
                onChange={(e) => setAnnual({ ...annual, notes: e.target.value })}
                rows={2} maxLength={500} placeholder="اختياري"
              />
            </div>
            <div className="text-xs text-muted-foreground bg-primary/5 rounded p-2">
              💡 يمكن تسجيل النقدية فقط، أو العينية فقط، أو كلاهما معاً.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
