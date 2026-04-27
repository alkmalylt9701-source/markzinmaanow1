import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { loadGlobalStudents, saveStudent, loadHifzHistory, saveHifzHistory, loadYearData, saveYearData } from "@/utils/storage";

interface Props { onDataImported: () => void; }

export const ImportExport = ({ onDataImported }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = async () => {
    const students = await loadGlobalStudents();
    if (students.length === 0) { toast.error("لا توجد بيانات لتصديرها"); return; }
    const exportData: Record<string, unknown>[] = [];
    for (const s of students) {
      const history = await loadHifzHistory(s.id);
      const row: Record<string, unknown> = {
        'الاسم': s.name,
        'حفظ_1441': history.h1441 || '', 'حفظ_1442': history.h1442 || '',
        'حفظ_1443': history.h1443 || '', 'حفظ_1444': history.h1444 || '',
        'حفظ_1445': history.h1445 || '', 'حفظ_1446': history.h1446 || '',
      };
      for (let y = 1442; y <= 1450; y++) {
        const yd = await loadYearData(y.toString(), s.id);
        if (yd.parts || yd.total !== '0') {
          row[`حفظ_جديد_${y}`] = yd.parts || '';
          row[`سنة_${y}`] = yd.annual || '';
          row[`تلاوة_${y}`] = yd.recitation || '';
          row[`حفظ_درجة_${y}`] = yd.memorization || '';
          row[`مجموع_${y}`] = yd.total || '';
          row[`تقدير_${y}`] = yd.grade || '';
          row[`مكافأة_${y}`] = yd.prize || '';
        }
      }
      exportData.push(row);
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "بيانات المسابقة");
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: 20 }));
    XLSX.writeFile(wb, `بيانات_المسابقة_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`تم تصدير بيانات ${students.length} طالبة`);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, unknown>[];
        if (json.length === 0) { toast.error("الملف فارغ"); return; }
        let imported = 0, updated = 0;
        const existing = await loadGlobalStudents();
        for (const row of json) {
          const name = String(row['الاسم'] || '').trim();
          if (!name) continue;
          let studentId: number;
          const found = existing.find((s) => s.name === name);
          if (!found) {
            const id = await saveStudent({ name, teacher: '' });
            if (!id) continue;
            studentId = id; imported++;
          } else { studentId = found.id; updated++; }
          const history = await loadHifzHistory(studentId);
          for (const y of [1441, 1442, 1443, 1444, 1445, 1446]) {
            if (row[`حفظ_${y}`]) history[`h${y}`] = String(row[`حفظ_${y}`]);
          }
          await saveHifzHistory(studentId, history);
          for (let y = 1442; y <= 1450; y++) {
            const yd = await loadYearData(y.toString(), studentId);
            let has = false;
            if (row[`حفظ_جديد_${y}`] !== undefined) { yd.parts = String(row[`حفظ_جديد_${y}`]); has = true; }
            if (row[`سنة_${y}`] !== undefined) { yd.annual = String(row[`سنة_${y}`]); has = true; }
            if (row[`تلاوة_${y}`] !== undefined) { yd.recitation = String(row[`تلاوة_${y}`]); has = true; }
            if (row[`حفظ_درجة_${y}`] !== undefined) { yd.memorization = String(row[`حفظ_درجة_${y}`]); has = true; }
            if (has) await saveYearData(y.toString(), studentId, yd);
          }
        }
        onDataImported();
        toast.success(`تم استيراد ${imported} طالبة جديدة وتحديث ${updated} طالبة`);
      } catch (err) {
        console.error(err);
        toast.error("خطأ في الاستيراد، تأكد من تنسيق ملف Excel");
      }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
  };

  const downloadTemplate = () => {
    const data = [{
      'الاسم': 'مثال: فاطمة أحمد',
      'حفظ_1441': '3', 'حفظ_1442': '5', 'حفظ_1443': '10',
      'حفظ_1444': '15', 'حفظ_1445': '20', 'حفظ_1446': '25',
      'حفظ_جديد_1447': '5', 'سنة_1447': '18', 'تلاوة_1447': '19', 'حفظ_درجة_1447': '55',
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قالب");
    ws['!cols'] = Array(11).fill({ wch: 20 });
    XLSX.writeFile(wb, 'قالب_استيراد_البيانات.xlsx');
    toast.success("تم تنزيل القالب");
  };

  return (
    <Card className="bg-card/50 border border-primary/20 print:hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors rounded-lg">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <FileSpreadsheet className="h-4 w-4" />
          <span>استيراد وتصدير البيانات</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={downloadTemplate} variant="outline" size="sm" className="gap-1 text-xs">
              <Download className="h-3 w-3" /> تنزيل القالب
            </Button>
            <Button variant="default" size="sm" className="gap-1 text-xs relative overflow-hidden">
              <Upload className="h-3 w-3" /> <span>استيراد</span>
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
            </Button>
            <Button onClick={handleExport} variant="secondary" size="sm" className="gap-1 text-xs">
              <Download className="h-3 w-3" /> تصدير
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">📝 نزّل القالب، عبّئ البيانات، ثم استورده.</p>
        </div>
      )}
    </Card>
  );
};
