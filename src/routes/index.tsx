import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetitionTable } from "@/components/CompetitionTable";
import { ImportExport } from "@/components/ImportExport";
import { Plus, Printer, Trash2, Calendar, LogOut, Save } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import logo from "@/assets/logo.png";
import { Student, HifzHistory, YearData, START_YEAR, END_YEAR } from "@/types/student";
import {
  loadAllStudentsWithData, saveStudent, deleteAllStudents, deleteStudent,
  getActiveYear, setActiveYear, saveHifzHistory, saveYearData, DuplicateNameError,
} from "@/utils/storage";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

interface DirtyData { name: string; teacher: string; history: HifzHistory; yearData: YearData; }

function IndexPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState("1447");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyMap, setDirtyMap] = useState<Record<number, DirtyData>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dirtyMapRef = useRef(dirtyMap);
  const studentsRef = useRef(students);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => { dirtyMapRef.current = dirtyMap; }, [dirtyMap]);
  useEffect(() => { studentsRef.current = students; }, [students]);

  const isDirty = Object.keys(dirtyMap).length > 0;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await loadAllStudentsWithData(currentYear);
    setStudents(data);
    setDirtyMap({});
    setLoading(false);
  }, [currentYear, user]);

  useEffect(() => {
    if (!user) return;
    getActiveYear().then(setCurrentYear);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDirtyChange = useCallback((id: number, d: DirtyData) => {
    setDirtyMap((prev) => ({ ...prev, [id]: d }));
  }, []);

  const performSave = useCallback(async (silent = false): Promise<boolean> => {
    const currentDirty = dirtyMapRef.current;
    const entries = Object.entries(currentDirty);
    if (entries.length === 0) return true;
    if (savingRef.current) return false;

    savingRef.current = true;
    setSaving(true);
    try {
      // التحقق من التكرار محلياً قبل الحفظ
      const namesSeen = new Map<string, number>();
      for (const [idStr, d] of entries) {
        const n = (d.name || '').trim();
        if (!n) continue;
        if (namesSeen.has(n)) {
          if (!silent) toast.error(`الاسم "${n}" مكرر في الجدول`);
          return false;
        }
        namesSeen.set(n, parseInt(idStr));
      }
      for (const s of studentsRef.current) {
        if (currentDirty[s.id]) continue;
        const existingName = (s.name || '').trim();
        if (existingName && namesSeen.has(existingName)) {
          if (!silent) toast.error(`الاسم "${existingName}" موجود مسبقاً`);
          return false;
        }
      }

      for (const [idStr, d] of entries) {
        const id = parseInt(idStr);
        await saveStudent({ id, name: d.name, teacher: d.teacher });
        await saveHifzHistory(id, d.history);
        await saveYearData(currentYear, id, d.yearData);
      }
      // إزالة المحفوظ فقط (قد تكون أضيفت تغييرات جديدة أثناء الحفظ)
      setDirtyMap((prev) => {
        const next = { ...prev };
        for (const [idStr] of entries) {
          if (next[parseInt(idStr)] === currentDirty[parseInt(idStr)]) {
            delete next[parseInt(idStr)];
          }
        }
        return next;
      });
      setLastSaved(new Date());
      if (!silent) toast.success(`تم حفظ بيانات ${entries.length} طالبة`);
      return true;
    } catch (err) {
      if (err instanceof DuplicateNameError) {
        if (!silent) toast.error(err.message);
      } else {
        console.error(err);
        if (!silent) toast.error("حدث خطأ أثناء الحفظ");
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [currentYear]);

  const handleSaveAll = useCallback(async () => {
    const ok = await performSave(false);
    if (ok) await loadData();
  }, [performSave, loadData]);

  // حفظ تلقائي بعد 1.5 ثانية من آخر تعديل
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave(true);
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirtyMap, isDirty, performSave]);

  // حفظ قبل إغلاق الصفحة
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirtyMapRef.current).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleYearChange = async (year: string) => {
    if (isDirty && !confirm('هناك تغييرات غير محفوظة، هل تريد المتابعة؟')) return;
    setCurrentYear(year);
    await setActiveYear(year);
    toast.success(`تم التبديل إلى ${year}هـ`);
  };

  const addNewStudent = async () => {
    if (isDirty) await handleSaveAll();
    const id = await saveStudent({ name: '', teacher: '' });
    if (id) { await loadData(); toast.success("تم إضافة طالبة جديدة"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الطالبة؟')) return;
    await deleteStudent(id);
    setDirtyMap((p) => { const n = { ...p }; delete n[id]; return n; });
    await loadData();
    toast.success("تم حذف الطالبة");
  };

  const handleReset = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع البيانات؟ لا يمكن التراجع!')) return;
    await deleteAllStudents();
    setStudents([]); setDirtyMap({});
    toast.success("تم حذف جميع البيانات");
  };

  // ranks
  useEffect(() => {
    const sorted = [...students]
      .filter((s) => parseFloat(s.yearData?.total || '0') > 0)
      .sort((a, b) => parseFloat(b.yearData?.total || '0') - parseFloat(a.yearData?.total || '0'));
    let changed = false;
    for (let i = 0; i < sorted.length; i++) {
      const newRank = (i + 1).toString();
      if (sorted[i].yearData && sorted[i].yearData!.rank !== newRank) {
        sorted[i].yearData!.rank = newRank;
        changed = true;
      }
    }
    if (changed) setStudents((p) => [...p]);
  }, [students.length, currentYear, students]);

  const now = new Date();
  const currentDate = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const dayName = now.toLocaleDateString('ar-EG', { weekday: 'long' });
  const hijriDate = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جارٍ التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary via-primary to-primary/90 text-primary-foreground py-6 px-4 print:py-4 shadow-lg">
        <div className="container mx-auto">
          <div className="flex flex-col items-center mb-4">
            <img src={logo} alt="الشعار" className="h-24 w-auto mb-4 print:h-20" />
          </div>
          <div className="flex justify-between items-start mb-4 print:mb-2">
            <div className="text-sm text-primary-foreground/90">
              <div className="font-bold">مركز إنماء الأهلي الخيري</div>
              <div>الإشراف - شرعب الرونة</div>
            </div>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold mb-2 print:text-2xl">بسم الله الرحمن الرحيم</h1>
              <h2 className="text-xl print:text-lg">كشف المسابقة الرمضانية للعام {currentYear}هـ</h2>
            </div>
            <div className="text-sm text-left text-primary-foreground/90">
              <div className="font-semibold">{dayName}</div>
              <div>{hijriDate}</div>
              <div>{currentDate}</div>
              <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 text-primary-foreground/80 hover:text-primary-foreground gap-1 print:hidden">
                <LogOut className="h-3 w-3" /> خروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 print:hidden space-y-4">
        <ImportExport onDataImported={loadData} />

        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-md border-2 border-primary">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">سنة المسابقة:</span>
              <Select value={currentYear} onValueChange={handleYearChange}>
                <SelectTrigger className="w-32 bg-background font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}هـ</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={addNewStudent} className="gap-2">
              <Plus className="h-4 w-4" /> إضافة طالبة جديدة
            </Button>

            <Button onClick={handleSaveAll} disabled={!isDirty || saving} variant={isDirty ? "default" : "secondary"} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'جارٍ الحفظ...' : isDirty ? 'حفظ الآن' : 'محفوظ'}
              {isDirty && <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{Object.keys(dirtyMap).length}</span>}
            </Button>

            <Button onClick={() => window.print()} variant="secondary" className="gap-2">
              <Printer className="h-4 w-4" /> طباعة
            </Button>

            <Button onClick={handleReset} variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" /> حذف جميع البيانات
            </Button>

            <div className="mr-auto text-sm text-muted-foreground flex flex-col items-end gap-0.5">
              <span>عدد الطالبات: <span className="font-bold text-foreground">{students.length}</span></span>
              <span className="text-xs">
                {saving ? '🔄 جارٍ الحفظ التلقائي...' : isDirty ? '✏️ تغييرات غير محفوظة...' : lastSaved ? `✓ تم الحفظ ${lastSaved.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : '✓ كل البيانات محفوظة'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ تحميل البيانات...</div>
        ) : (
          <CompetitionTable students={students} currentYear={currentYear} onDelete={handleDelete} dirtyMap={dirtyMap} onDirtyChange={handleDirtyChange} />
        )}
      </div>

      <footer className="text-center text-sm text-muted-foreground py-4 print:py-2 border-t border-border">
        تصميم أ/ مختار الكمالي
      </footer>
    </div>
  );
}
