import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Pencil, Trash2, Users, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/teachers")({
  component: TeachersPage,
});

interface Teacher {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

interface StudentRow {
  id: number;
  name: string;
  teacher: string;
}

function TeachersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [assigningTo, setAssigningTo] = useState<Teacher | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      supabase.from("teachers").select("*").eq("user_id", user.id).order("name"),
      supabase.from("students").select("id,name,teacher").eq("user_id", user.id).order("id"),
    ]);
    if (tRes.error) toast.error("تعذر تحميل المعلمات");
    setTeachers((tRes.data || []) as Teacher[]);
    setStudents((sRes.data || []) as StudentRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", phone: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({ name: t.name, phone: t.phone || "", notes: t.notes || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) { toast.error("الاسم مطلوب"); return; }
    if (name.length > 100) { toast.error("الاسم طويل جداً"); return; }
    const payload = {
      user_id: user.id,
      name,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const oldName = editing.name;
      const { error } = await supabase.from("teachers").update(payload).eq("id", editing.id);
      if (error) {
        if (error.code === "23505") toast.error("اسم المعلمة موجود مسبقاً");
        else toast.error("فشل الحفظ");
        return;
      }
      // مزامنة اسم المعلمة في الطالبات
      if (oldName !== name) {
        await supabase.from("students").update({ teacher: name }).eq("user_id", user.id).eq("teacher", oldName);
      }
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("teachers").insert(payload);
      if (error) {
        if (error.code === "23505") toast.error("اسم المعلمة موجود مسبقاً");
        else toast.error("فشل الإضافة");
        return;
      }
      toast.success("تمت الإضافة");
    }
    setOpen(false);
    await load();
  };

  const handleDelete = async (t: Teacher) => {
    if (!confirm(`حذف المعلمة "${t.name}"؟`)) return;
    const { error } = await supabase.from("teachers").delete().eq("id", t.id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    await load();
  };

  const handleAssignStudent = async () => {
    if (!user || !assigningTo || !selectedStudentId) return;
    const { error } = await supabase
      .from("students")
      .update({ teacher: assigningTo.name })
      .eq("id", parseInt(selectedStudentId))
      .eq("user_id", user.id);
    if (error) { toast.error("فشل الربط"); return; }
    toast.success("تم الربط");
    setSelectedStudentId("");
    await load();
  };

  const handleUnassign = async (studentId: number) => {
    if (!user) return;
    const { error } = await supabase.from("students").update({ teacher: "" }).eq("id", studentId).eq("user_id", user.id);
    if (error) { toast.error("فشل الإلغاء"); return; }
    await load();
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جارٍ التحميل...</div>;
  }

  const studentsByTeacher = (name: string) => students.filter((s) => s.teacher === name);
  const unassignedStudents = students.filter((s) => !s.teacher || !teachers.some((t) => t.name === s.teacher));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary via-primary to-primary/90 text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="الشعار" className="h-14 w-auto" />
            <div>
              <h1 className="text-xl font-bold">المعلمات</h1>
              <div className="text-sm text-primary-foreground/85">إدارة المعلمات وربط الطالبات</div>
            </div>
          </div>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرجوع للرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-bold">إجمالي المعلمات: {teachers.length}</span>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> إضافة معلمة
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-lg">
            لا توجد معلمات بعد — ابدأ بإضافة معلمة من الأعلى.
          </div>
        ) : (
          <div className="space-y-4">
            {teachers.map((t) => {
              const myStudents = studentsByTeacher(t.name);
              return (
                <div key={t.id} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <Link
                        to="/teachers/$teacherId"
                        params={{ teacherId: t.id }}
                        className="font-bold text-primary text-lg hover:underline cursor-pointer"
                      >
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground space-x-2 space-x-reverse">
                        {t.phone && <span>📞 {t.phone}</span>}
                        <span>الطالبات: {myStudents.length}</span>
                      </div>
                      {t.notes && <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button onClick={() => { setAssigningTo(t); setSelectedStudentId(""); }} variant="ghost" size="sm" className="gap-1">
                        <UserPlus className="h-4 w-4" /> ربط طالبة
                      </Button>
                      <Button onClick={() => openEdit(t)} variant="ghost" size="sm" className="gap-1">
                        <Pencil className="h-4 w-4" /> تعديل
                      </Button>
                      <Button onClick={() => handleDelete(t)} variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {myStudents.length > 0 && (
                    <div className="divide-y divide-border">
                      {myStudents.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                          <div className="text-sm">{s.name || <span className="text-muted-foreground">(بدون اسم)</span>}</div>
                          <Button onClick={() => handleUnassign(s.id)} variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs">
                            إلغاء الربط
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {assigningTo?.id === t.id && (
                    <div className="bg-muted/30 border-t border-border p-3 flex flex-wrap gap-2 items-center">
                      <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="w-64 bg-background"><SelectValue placeholder="اختر طالبة..." /></SelectTrigger>
                        <SelectContent>
                          {unassignedStudents.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد طالبات بدون معلمة</div>
                          ) : unassignedStudents.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name || `طالبة #${s.id}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssignStudent} disabled={!selectedStudentId} size="sm">ربط</Button>
                      <Button onClick={() => setAssigningTo(null)} variant="ghost" size="sm">إغلاق</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {unassignedStudents.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="font-bold mb-2 text-muted-foreground">طالبات بدون معلمة ({unassignedStudents.length})</div>
            <div className="flex flex-wrap gap-2">
              {unassignedStudents.map((s) => (
                <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded">{s.name || `#${s.id}`}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل معلمة" : "إضافة معلمة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold mb-1 block">الاسم *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} placeholder="اسم المعلمة" />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">الهاتف</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} placeholder="اختياري" />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">ملاحظات</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="اختياري" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={handleSave}>{editing ? "تحديث" : "إضافة"}</Button>
            <Button onClick={() => setOpen(false)} variant="outline">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
