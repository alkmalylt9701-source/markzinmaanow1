import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRight, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/beneficiaries")({
  head: () => ({ meta: [
    { title: "سجل المستفيدين — الأيتام والأسر" },
    { name: "description", content: "سجل الأيتام والأسر المحتاجة وأفضل أسرة للمركز" },
  ]}),
  component: BeneficiariesPage,
});

type Kind = "orphan" | "needy" | "best_family";
interface Beneficiary { id: string; kind: Kind; name: string; guardian: string | null; phone: string | null; notes: string | null; }

const KIND_LABEL: Record<Kind, string> = { orphan: "أيتام", needy: "أسر محتاجة", best_family: "أفضل أسرة" };

function BeneficiariesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [tab, setTab] = useState<Kind>("orphan");
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", guardian: "", phone: "", notes: "" });

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("beneficiaries").select("*").eq("user_id", user.id).order("name");
    setRows((data || []) as Beneficiary[]);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ name: "", guardian: "", phone: "", notes: "" }); setOpen(true); };
  const openEdit = (b: Beneficiary) => { setEditing(b); setForm({ name: b.name, guardian: b.guardian || "", phone: b.phone || "", notes: b.notes || "" }); setOpen(true); };

  const save = async () => {
    if (!user || !form.name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (editing) {
      await supabase.from("beneficiaries").update({ ...form }).eq("id", editing.id);
      toast.success("تم التحديث");
    } else {
      await supabase.from("beneficiaries").insert({ user_id: user.id, kind: tab, ...form });
      toast.success("تمت الإضافة");
    }
    setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    await supabase.from("beneficiaries").delete().eq("id", id);
    load();
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center" dir="rtl">جارٍ التحميل...</div>;

  const filtered = rows.filter((r) => r.kind === tab);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">سجل المستفيدين</h1>
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground gap-1">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="orphan">أيتام</TabsTrigger>
              <TabsTrigger value="needy">أسر محتاجة</TabsTrigger>
              <TabsTrigger value="best_family">أفضل أسرة</TabsTrigger>
            </TabsList>
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إضافة</Button>
          </div>

          <TabsContent value={tab}>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-primary/10">
                  <tr>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-right">ولي الأمر</th>
                    <th className="p-2 text-right">الجوال</th>
                    <th className="p-2 text-right">ملاحظات</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد سجلات في قسم "{KIND_LABEL[tab]}"</td></tr>
                  ) : filtered.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-2 font-semibold">{b.name}</td>
                      <td className="p-2">{b.guardian || "-"}</td>
                      <td className="p-2">{b.phone || "-"}</td>
                      <td className="p-2 text-muted-foreground">{b.notes || "-"}</td>
                      <td className="p-2 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "تعديل سجل" : `إضافة في: ${KIND_LABEL[tab]}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">الاسم *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-sm">ولي الأمر</label><Input value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} /></div>
            <div><label className="text-sm">الجوال</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="text-sm">ملاحظات</label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
