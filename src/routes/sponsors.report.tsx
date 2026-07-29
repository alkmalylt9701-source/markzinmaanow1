import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/sponsors/report")({
  validateSearch: z.object({ year: z.string().default("1447") }),
  head: () => ({
    meta: [
      { title: "تقرير الرعاة - المسابقة الرمضانية" },
      { name: "description", content: "تقرير سنوي عن رعاة وممولي المسابقة الرمضانية." },
      { property: "og:title", content: "تقرير الرعاة" },
      { property: "og:description", content: "تقرير سنوي قابل للطباعة والمشاركة." },
    ],
  }),
  component: ReportPage,
});

interface Row {
  id: string;
  sponsor_name: string;
  sponsor_type: string;
  phone: string | null;
  cash_amount: number;
  in_kind_description: string | null;
  in_kind_value: number;
  sponsorship_areas: string[];
  notes: string | null;
}

function ReportPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { year } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<{ item: string; category: string | null; cash_amount: number; in_kind_value: number }[]>([]);
  const [honorariums, setHonorariums] = useState<{ recipient_kind: string; cash_amount: number; in_kind_value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: sps }, { data: cs }, { data: es }, { data: hs }] = await Promise.all([
      supabase.from("sponsors").select("*").eq("user_id", user.id),
      supabase.from("sponsor_contributions").select("*").eq("user_id", user.id).eq("year", year),
      supabase.from("ceremony_expenses").select("item,category,cash_amount,in_kind_value").eq("user_id", user.id).eq("year", year),
      supabase.from("honorariums").select("recipient_kind,cash_amount,in_kind_value").eq("user_id", user.id).eq("year", year),
    ]);
    const spMap = new Map((sps || []).map((s: any) => [s.id, s]));
    const out: Row[] = (cs || []).map((c: any) => {
      const s: any = spMap.get(c.sponsor_id) || {};
      return {
        id: c.id, sponsor_name: s.name || "—", sponsor_type: s.sponsor_type || "individual", phone: s.phone,
        cash_amount: Number(c.cash_amount), in_kind_description: c.in_kind_description, in_kind_value: Number(c.in_kind_value),
        sponsorship_areas: c.sponsorship_areas || [], notes: c.notes,
      };
    }).sort((a, b) => (b.cash_amount + b.in_kind_value) - (a.cash_amount + a.in_kind_value));
    setRows(out);
    setExpenses((es || []) as any);
    setHonorariums((hs || []) as any);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { load(); }, [load]);

  const totalCash = rows.reduce((s, r) => s + r.cash_amount, 0);
  const totalInKind = rows.reduce((s, r) => s + r.in_kind_value, 0);
  const expCash = expenses.reduce((s, e) => s + Number(e.cash_amount), 0);
  const expInKind = expenses.reduce((s, e) => s + Number(e.in_kind_value), 0);
  const honCash = honorariums.reduce((s, h) => s + Number(h.cash_amount), 0);
  const honInKind = honorariums.reduce((s, h) => s + Number(h.in_kind_value), 0);

  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white" dir="rtl">
      <div className="print:hidden bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/sponsors"><ArrowRight className="h-4 w-4 ml-1" /> رجوع</Link></Button>
          <div className="flex-1" />
          <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> طباعة / حفظ PDF</Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 print:p-0 print:max-w-none">
        <div className="bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none p-8 print:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center border-b-2 border-primary pb-4 mb-6">
            <img src={logo} alt="شعار" className="h-20 w-20 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-primary">مركز إنماء الأهلي الخيري</h1>
            <h2 className="text-xl mt-1">تقرير الرعاة والممولين</h2>
            <p className="text-lg mt-1">المسابقة الرمضانية - عام {year}هـ</p>
            <p className="text-sm text-muted-foreground mt-2">تاريخ الإصدار: {today}</p>
          </div>

          <p className="text-center leading-loose mb-6">
            بسم الله الرحمن الرحيم، والحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين.
            <br />يسر مركز إنماء الأهلي الخيري أن يقدم لكم تقريراً موجزاً عن الرعاة الكرام الذين ساهموا في إنجاح المسابقة الرمضانية لعام {year}هـ،
            سائلين المولى عز وجل أن يجعله في ميزان حسناتكم.
          </p>

          {loading ? <p className="text-center py-8">جارٍ التحميل...</p> : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="border rounded-lg p-3 bg-primary/5">
                  <div className="text-xs text-muted-foreground">إجمالي الرعاية النقدية</div>
                  <div className="text-xl font-bold text-primary">{totalCash.toLocaleString("ar-SA")} ر.س</div>
                </div>
                <div className="border rounded-lg p-3 bg-primary/5">
                  <div className="text-xs text-muted-foreground">إجمالي الرعاية العينية</div>
                  <div className="text-xl font-bold text-primary">{totalInKind.toLocaleString("ar-SA")} ر.س</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">عدد الرعاة</div>
                  <div className="text-xl font-bold">{rows.length}</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">الإجمالي الكلي للتبرعات</div>
                  <div className="text-xl font-bold text-primary">{(totalCash + totalInKind).toLocaleString("ar-SA")} ر.س</div>
                </div>
              </div>

              {/* Sponsors Table */}
              <h3 className="text-lg font-bold text-primary mb-3">قائمة الرعاة الكرام</h3>
              {rows.length === 0 ? <p className="text-center text-muted-foreground py-6 border rounded">لا توجد مساهمات مسجلة لهذا العام</p> : (
                <table className="w-full text-sm border-collapse mb-6">
                  <thead className="bg-primary/10">
                    <tr>
                      <th className="border p-2 text-right">الراعي</th>
                      <th className="border p-2">نقدي (ر.س)</th>
                      <th className="border p-2">عيني (ر.س)</th>
                      <th className="border p-2 text-right">وصف العيني</th>
                      <th className="border p-2 text-right">مجالات الرعاية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="break-inside-avoid">
                        <td className="border p-2 font-semibold">{r.sponsor_name}</td>
                        <td className="border p-2 text-center">{r.cash_amount.toLocaleString("ar-SA")}</td>
                        <td className="border p-2 text-center">{r.in_kind_value.toLocaleString("ar-SA")}</td>
                        <td className="border p-2 text-xs">{r.in_kind_description || "-"}</td>
                        <td className="border p-2 text-xs">{r.sponsorship_areas.join("، ") || "-"}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-bold">
                      <td className="border p-2">الإجمالي</td>
                      <td className="border p-2 text-center">{totalCash.toLocaleString("ar-SA")}</td>
                      <td className="border p-2 text-center">{totalInKind.toLocaleString("ar-SA")}</td>
                      <td className="border p-2" colSpan={2}>الإجمالي الكلي: {(totalCash + totalInKind).toLocaleString("ar-SA")} ر.س</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Utilization */}
              <h3 className="text-lg font-bold text-primary mb-3">أوجه صرف التبرعات</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="border rounded-lg p-3">
                  <h4 className="font-bold mb-2">إكراميات الموزعة</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>نقدي:</span><span>{honCash.toLocaleString("ar-SA")} ر.س</span></div>
                    <div className="flex justify-between"><span>عيني:</span><span>{honInKind.toLocaleString("ar-SA")} ر.س</span></div>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <h4 className="font-bold mb-2">مصروفات الحفل</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>نقدي:</span><span>{expCash.toLocaleString("ar-SA")} ر.س</span></div>
                    <div className="flex justify-between"><span>عيني:</span><span>{expInKind.toLocaleString("ar-SA")} ر.س</span></div>
                  </div>
                </div>
              </div>

              {/* Thanks */}
              <div className="border-t-2 border-primary pt-4 mt-8 text-center leading-loose">
                <p className="font-bold text-lg">جزاكم الله خيراً</p>
                <p className="text-sm">
                  نشكر لكم كرم عطائكم وحسن مساندتكم، ونسأل الله أن يبارك في أموالكم وأولادكم،
                  وأن يجعل ما بذلتم في موازين حسناتكم يوم القيامة.
                </p>
                <p className="text-xs text-muted-foreground mt-4">مركز إنماء الأهلي الخيري • {today}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
