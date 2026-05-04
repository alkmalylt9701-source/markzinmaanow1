import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Upload, ArrowRight, Trash2, FileText, Image as ImageIcon, Video, FileSpreadsheet, Download, Eye, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { START_YEAR, END_YEAR } from "@/types/student";
import { getActiveYear, setActiveYear } from "@/utils/storage";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
});

interface DocRow {
  id: string;
  year: string;
  month: number;
  file_name: string;
  file_path: string;
  file_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

function detectType(file: File): string {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv")) return "excel";
  return "file";
}

function TypeIcon({ t }: { t: string }) {
  if (t === "image") return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (t === "video") return <Video className="h-5 w-5 text-purple-500" />;
  if (t === "excel") return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatSize(b: number | null): string {
  if (!b) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("1447");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "size_desc" | "size_asc">(
    () => (typeof window !== "undefined" && (localStorage.getItem("documentsSortBy") as any)) || "date_desc"
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("documentsSortBy", sortBy); }, [sortBy]);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) getActiveYear().then(setYear); }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("documents").select("*").eq("year", year).order("month").order("created_at");
    if (error) { toast.error("تعذر تحميل الوثائق"); console.error(error); }
    setDocs((data || []) as DocRow[]);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { load(); }, [load]);

  const handleYearChange = async (y: string) => {
    setYear(y);
    await setActiveYear(y);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const type = detectType(file);
        const ext = file.name.split(".").pop() || "";
        const path = `${user.id}/${year}/${selectedMonth}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(`فشل رفع ${file.name}`); console.error(upErr); continue; }
        const { error: insErr } = await supabase.from("documents").insert({
          user_id: user.id, year, month: selectedMonth,
          file_name: file.name, file_path: path, file_type: type,
          mime_type: file.type, size_bytes: file.size,
        });
        if (insErr) { toast.error(`فشل حفظ ${file.name}`); console.error(insErr); continue; }
      }
      toast.success("تم الرفع");
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (d: DocRow) => {
    if (!confirm(`حذف "${d.file_name}"؟`)) return;
    await supabase.storage.from("documents").remove([d.file_path]);
    await supabase.from("documents").delete().eq("id", d.id);
    toast.success("تم الحذف");
    await load();
  };

  const handleView = async (d: DocRow) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 3600);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleDownload = async (d: DocRow) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 3600, { download: d.file_name });
    if (error || !data) { toast.error("تعذر التنزيل"); return; }
    window.open(data.signedUrl, "_blank");
  };

  // Group by month with sorting
  const sortItems = (arr: DocRow[]) => {
    const sorted = [...arr];
    sorted.sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "date_asc") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "size_desc") return (b.size_bytes || 0) - (a.size_bytes || 0);
      if (sortBy === "size_asc") return (a.size_bytes || 0) - (b.size_bytes || 0);
      return 0;
    });
    return sorted;
  };
  const byMonth = HIJRI_MONTHS.map((name, i) => ({
    month: i + 1, name,
    items: sortItems(docs.filter((d) => d.month === i + 1)),
  })).filter((g) => g.items.length > 0);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جارٍ التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-gradient-to-l from-primary via-primary to-primary/90 text-primary-foreground py-6 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="الشعار" className="h-14 w-auto" />
            <div>
              <h1 className="text-xl font-bold">الوثائق</h1>
              <div className="text-sm text-primary-foreground/85">صور وفيديوهات وملفات إكسل لكل عام</div>
            </div>
          </div>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/"><ArrowRight className="h-4 w-4" /> الرجوع للرئيسية</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
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

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">الشهر:</span>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HIJRI_MONTHS.map((n, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileRef} type="file" multiple hidden
            accept="image/*,video/*,.xlsx,.xls,.csv,application/pdf"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" /> {uploading ? "جارٍ الرفع..." : "رفع وثائق"}
          </Button>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">الترتيب:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">الأحدث أولاً</SelectItem>
                <SelectItem value="date_asc">الأقدم أولاً</SelectItem>
                <SelectItem value="size_desc">الأكبر حجماً</SelectItem>
                <SelectItem value="size_asc">الأصغر حجماً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mr-auto text-sm text-muted-foreground">
            إجمالي الوثائق: <span className="font-bold text-foreground">{docs.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : byMonth.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-lg">
            لا توجد وثائق لعام {year}هـ — ابدأ برفع ملفات من الأعلى.
          </div>
        ) : (
          <div className="space-y-4">
            {byMonth.map((g) => (
              <div key={g.month} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-primary/10 border-b border-border px-4 py-2 flex items-center justify-between">
                  <div className="font-bold text-primary">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.items.length} ملف</div>
                </div>
                <div className="divide-y divide-border">
                  {g.items.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30">
                      <TypeIcon t={d.file_type} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{d.file_name}</div>
                        <div className="text-xs text-muted-foreground">{formatSize(d.size_bytes)} • {new Date(d.created_at).toLocaleDateString("ar-EG")}</div>
                      </div>
                      <Button onClick={() => handleView(d)} variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" /> عرض
                      </Button>
                      <Button onClick={() => handleDownload(d)} variant="ghost" size="sm" className="gap-1">
                        <Download className="h-4 w-4" /> تنزيل
                      </Button>
                      <Button onClick={() => handleDelete(d)} variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
