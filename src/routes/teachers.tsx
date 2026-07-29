import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Pencil, Trash2, Users, Gift, FileText, Calendar, X, UserPlus, ChevronDown, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import { START_YEAR, END_YEAR } from "@/types/student";
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
  const [year, setYear] = useState("1447");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addStudentTo, setAddStudentTo] = useState<Teacher | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, sRes, aRes, yRes] = await Promise.all([
      supabase.from("teachers").select("*").eq("user_id", user.id).order("name"),
      supabase.from("students").select("id,name,teacher").eq("user_id", user.id).order("id"),
      supabase.from("teacher_year_active").select("teacher_id").eq("user_id", user.id).eq("year", year),
      supabase.from("year_data").select("student_id,teacher").eq("user_id", user.id).eq("year", year),
    ]);
    if (tRes.error) toast.error("تعذر تحميل المعلمات");
    const yearMap = new Map<number, string>();
    (yRes.data || []).forEach((r: any) => yearMap.set(r.student_id, r.teacher || ""));
    const activeYear = await getActiveYear();
    const merged = (sRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      teacher: yearMap.has(s.id) ? (yearMap.get(s.id) || "") : (year === activeYear ? (s.teacher || "") : ""),
    }));
    setTeachers((tRes.data || []) as Teacher[]);
    setStudents(merged as StudentRow[]);
    setActiveIds(new Set((aRes.data || []).map((r: any) => r.teacher_id)));
    setLoading(false);
  }, [user, year]);


  useEffect(() => { load(); }, [load]);

  const handleYearChange = async (y: string) => {
    setYear(y);
    setExpanded(new Set());
    await setActiveYear(y);
  };

  const toggleActive = async (t: Teacher, checked: boolean) => {
    if (!user) return;
    // optimistic
    setActiveIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(t.id); else n.delete(t.id);
      return n;
    });
    if (checked) {
      const { error } = await supabase.from("teacher_year_active").insert({
        user_id: user.id, teacher_id: t.id, year,
      });
      if (error && error.code !== "23505") { toast.error("فشل التفعيل"); await load(); }
    } else {
      const { error } = await supabase.from("teacher_year_active")
        .delete().eq("user_id", user.id).eq("teacher_id", t.id).eq("year", year);
      if (error) { toast.error("فشل الإلغاء"); await load(); }
    }
  };

  const openAdd = () => { setEditing(null); setForm({ name: "", phone: "", notes: "" }); setOpen(true); };
  const openEdit = (t: Teacher) => { setEditing(t); setForm({ name: t.name, phone: t.phone || "", notes: t.notes || "" }); setOpen(true); };

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    if (!name) { toast.error("الاسم مطلوب"); return; }
    if (name.length > 100) { toast.error("الاسم طويل جداً"); return; }
    const payload = { user_id: user.id, name, phone: form.phone.trim() || null, notes: form.notes.trim() || null };
    if (editing) {
      const oldName = editing.name;
      const { error } = await supabase.from("teachers").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.code === "23505" ? "اسم المعلمة موجود مسبقاً" : "فشل الحفظ"); return; }
      setTeachers((prev) => prev.map((t) => t.id === editing.id ? { ...t, name, phone: payload.phone, notes: payload.notes } : t));
      if (oldName !== name) {
        setStudents((prev) => prev.map((s) => s.teacher === oldName ? { ...s, teacher: name } : s));
        await supabase.from("students").update({ teacher: name }).eq("user_id", user.id).eq("teacher", oldName);
      }
      toast.success("تم التحديث");
    } else {
      const { data, error } = await supabase.from("teachers").insert(payload).select().single();
      if (error) { toast.error(error.code === "23505" ? "اسم المعلمة موجود مسبقاً" : "فشل الإضافة"); return; }
      if (data) setTeachers((prev) => [...prev, data as Teacher].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("تمت الإضافة");
    }
    setOpen(false);
  };

  const handleDelete = async (t: Teacher) => {
    if (!confirm(`حذف المعلمة "${t.name}"؟`)) return;
    const { error } = await supabase.from("teachers").delete().eq("id", t.id);
    if (error) { toast.error("فشل الحذف"); return; }
    setTeachers((prev) => prev.filter((x) => x.id !== t.id));
    setActiveIds((prev) => { const n = new Set(prev); n.delete(t.id); return n; });
    toast.success("تم الحذف");
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const assignStudent = async (studentId: number, teacherName: string) => {
    if (!user) return;
    setStudents((prev) => prev.map((s) => s.id === studentId ? { ...s, teacher: teacherName } : s));
    const { error: yErr } = await supabase.from("year_data")
      .upsert({ user_id: user.id, student_id: studentId, year, teacher: teacherName }, { onConflict: "student_id,year" });
    if (yErr) { toast.error("فشل التحديث"); await load(); return; }
    const activeYear = await getActiveYear();
    if (year === activeYear) {
      await supabase.from("students")
        .update({ teacher: teacherName }).eq("id", studentId).eq("user_id", user.id);
    }
    toast.success("تم التحديث");
  };


  const removeStudent = async (studentId: number) => {
    if (!user) return;
    if (!confirm("إزالة الطالبة من هذه المعلمة؟")) return;
    await assignStudent(studentId, "");
  };

  const handleAddStudent = async () => {
    if (!addStudentTo || !selectedStudentId) return;
    await assignStudent(parseInt(selectedStudentId), addStudentTo.name);
    setSelectedStudentId("");
    setAddStudentTo(null);
  };

  const unassignedStudents = useMemo(
    () => students.filter((s) => !s.teacher || !teachers.some((t) => t.name === s.teacher)),
    [students, teachers]
  );

  const countStudents = (name: string) => students.filter((s) => s.teacher === name).length;
  const teacherStudents = (name: string) => students.filter((s) => s.teacher === name);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جارٍ التحميل...</div>;
  }

  const activeTeachers = teachers.filter((t) => activeIds.has(t.id));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary via-primary to-primary/90 text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="الشعار" className="h-14 w-auto" />
            <div>
              <h1 className="text-xl font-bold">المعلمات</h1>
              <div className="text-sm text-primary-foreground/85">إدارة المعلمات لكل عام هجري</div>
            </div>
          </div>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرجوع للرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* شريط السنة */}
        <div className="bg-card border-2 border-primary/40 rounded-lg p-4 shadow-sm flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">السنة الهجرية:</span>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger className="w-32 bg-background font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">إجمالي المعلمات: </span>
            <span className="font-bold">{teachers.length}</span>
            <span className="mx-3 text-muted-foreground">|</span>
            <span className="text-muted-foreground">النشطات لسنة {year}هـ: </span>
            <span className="font-bold text-primary">{activeTeachers.length}</span>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> إضافة معلمة
          </Button>
        </div>

        {/* قائمة اختيار المعلمات النشطات هذا العام */}
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="bg-primary/10 border-b border-border px-4 py-3 font-bold text-primary flex items-center gap-2">
            <Users className="h-5 w-5" /> معلمات سنة {year}هـ — علّمي على المعلمات الموجودات هذا العام
          </div>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : teachers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              لا توجد معلمات بعد — أضيفي معلمة من زر «إضافة معلمة».
            </div>
          ) : (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {teachers.map((t) => {
                const isActive = activeIds.has(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition ${
                      isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={(v) => toggleActive(t, v === true)}
                    />
                    <span className="font-semibold text-sm truncate">{t.name}</span>
                    <span className="mr-auto text-xs text-muted-foreground">{countStudents(t.name)} طالبة</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* المعلمات النشطات + تعديل الطالبات لكل معلمة */}
        {activeTeachers.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground font-semibold px-1">
              🎓 المعلمات النشطات لسنة {year}هـ — اضغطي على معلمة لتعديل طالباتها
            </div>
            {activeTeachers.map((t) => {
              const isOpen = expanded.has(t.id);
              const list = teacherStudents(t.name);
              return (
                <div key={t.id} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border">
                    <button onClick={() => toggleExpand(t.id)} className="flex items-center gap-1 font-bold text-primary hover:underline w-full">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      {t.name}
                      <span className="text-xs bg-primary/15 text-primary rounded-full px-2 py-0.5 mr-2">{list.length} طالبة</span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1">

                      <Button asChild variant="outline" size="sm" className="gap-1 h-8" title="إكرامية شهرية">
                        <Link to="/teachers/$teacherId" params={{ teacherId: t.id }} hash="monthly">
                          <Gift className="h-3.5 w-3.5" /> شهرية
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="gap-1 h-8" title="إكرامية سنوية">
                        <Link to="/teachers/$teacherId" params={{ teacherId: t.id }} hash="annual">
                          🎁 سنوية
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="gap-1 h-8" title="تقارير">
                        <Link to="/teachers/$teacherId" params={{ teacherId: t.id }} hash="reports">
                          <FileText className="h-3.5 w-3.5" /> تقارير
                        </Link>
                      </Button>
                      <Button onClick={() => { setAddStudentTo(t); setSelectedStudentId(""); }} variant="ghost" size="sm" className="gap-1 h-8" title="إضافة طالبة">
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button onClick={() => openEdit(t)} variant="ghost" size="sm" className="gap-1 h-8" title="تعديل">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button onClick={() => handleDelete(t)} variant="ghost" size="sm" className="gap-1 h-8 text-destructive hover:text-destructive" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="p-3 space-y-2">
                      {list.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-3">
                          لا توجد طالبات مرتبطات — أضيفي طالبة من زر <UserPlus className="inline h-3.5 w-3.5" />.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {list.map((s) => (
                            <div key={s.id} className="flex items-center gap-1 bg-primary/10 text-primary text-sm rounded-full pr-3 pl-1 py-1">
                              <span className="font-semibold">{s.name || `#${s.id}`}</span>
                              <button
                                onClick={() => removeStudent(s.id)}
                                className="hover:bg-destructive/20 text-destructive rounded-full p-0.5"
                                title="إزالة"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* نقل سريع لطالبات معلمات أخرى */}
                      <div className="pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-1">نقل طالبة من معلمة أخرى إلى «{t.name}»:</div>
                        <Select
                          value=""
                          onValueChange={(v) => assignStudent(parseInt(v), t.name)}
                        >
                          <SelectTrigger className="bg-background h-9">
                            <SelectValue placeholder="اختاري طالبة لنقلها..." />
                          </SelectTrigger>
                          <SelectContent>
                            {students.filter((s) => s.teacher !== t.name).length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">لا توجد طالبات أخرى</div>
                            ) : (
                              students
                                .filter((s) => s.teacher !== t.name)
                                .map((s) => (
                                  <SelectItem key={s.id} value={s.id.toString()}>
                                    {s.name || `#${s.id}`}
                                    {s.teacher ? ` — (حالياً: ${s.teacher})` : " — (بدون معلمة)"}
                                  </SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* الطالبات بدون معلمة */}
        {unassignedStudents.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="font-bold mb-2 text-muted-foreground">
              طالبات بدون معلمة ({unassignedStudents.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {unassignedStudents.map((s) => (
                <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded">
                  {s.name || `#${s.id}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* نافذة إضافة/تعديل */}
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

      {/* نافذة إضافة طالبة لمعلمة */}
      <Dialog open={!!addStudentTo} onOpenChange={(o) => !o && setAddStudentTo(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة طالبة إلى {addStudentTo?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="اختاري طالبة..." /></SelectTrigger>
              <SelectContent>
                {students.filter((s) => s.teacher !== addStudentTo?.name).length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد طالبات متاحة</div>
                ) : students
                    .filter((s) => s.teacher !== addStudentTo?.name)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name || `طالبة #${s.id}`}
                        {s.teacher ? ` — (حالياً: ${s.teacher})` : " — (بدون معلمة)"}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={handleAddStudent} disabled={!selectedStudentId}>إضافة</Button>
            <Button onClick={() => setAddStudentTo(null)} variant="outline">إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
