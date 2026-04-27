import { useState, useMemo, useCallback } from "react";
import { Student, HifzHistory, YearData } from "@/types/student";
import { TableHeader, type SortField, type SortDirection } from "./table/TableHeader";
import { TableRow } from "./table/TableRow";
import { TableFilters } from "./table/TableFilters";
import { calculateGrade, calculateBaseHifz } from "@/utils/calculations";
import logo from "@/assets/logo.png";

interface DirtyData { name: string; teacher: string; history: HifzHistory; yearData: YearData; }

interface Props {
  students: Student[];
  currentYear: string;
  onDelete: (id: number) => void;
  dirtyMap: Record<number, DirtyData>;
  onDirtyChange: (studentId: number, data: DirtyData) => void;
}

export const CompetitionTable = ({ students, currentYear, onDelete, onDirtyChange }: Props) => {
  const [selectedTeacher, setSelectedTeacher] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [partsFilter, setPartsFilter] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else { setSortField(field); setSortDirection('asc'); }
  }, [sortField, sortDirection]);

  const teachers = useMemo(() => Array.from(new Set(students.map((s) => s.teacher).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')), [students]);
  const currentYearNum = parseInt(currentYear);

  const getSortValue = useCallback((s: Student, f: SortField): string | number => {
    const parts = parseFloat(s.yearData?.parts || '0');
    const totalScore = parseFloat(s.yearData?.total || '0');
    const baseHifz = calculateBaseHifz(s.hifzHistory || {}, currentYearNum);
    switch (f) {
      case 'name': return s.name || '';
      case 'teacher': return s.teacher || '';
      case 'baseHifz': return baseHifz;
      case 'parts': return parts;
      case 'totalHifz': return Math.min(baseHifz + parts, 30);
      case 'annual': return parseFloat(s.yearData?.annual || '0');
      case 'recitation': return parseFloat(s.yearData?.recitation || '0');
      case 'memorization': return parseFloat(s.yearData?.memorization || '0');
      case 'total': return totalScore;
      case 'status': return parts > 0 || totalScore > 0 ? 1 : 0;
      case 'grade': {
        const { grade } = calculateGrade(totalScore);
        const order: Record<string, number> = { 'ممتاز': 5, 'جيد جداً': 4, 'جيد': 3, 'مقبول': 2, 'ضعيف': 1, '': 0 };
        return order[grade] || 0;
      }
      case 'prize': return parseFloat(s.yearData?.prize || '0');
      case 'statusPrize': return parseFloat(s.yearData?.statusPrize || '0');
      case 'rank': return parseFloat(s.yearData?.rank || '0') || 9999;
      default: return 0;
    }
  }, [currentYearNum]);

  const filteredStudents = useMemo(() => {
    const filtered = students.filter((s) => {
      if (selectedTeacher !== "all" && s.teacher !== selectedTeacher) return false;
      if (nameFilter && !s.name.includes(nameFilter)) return false;
      const parts = parseFloat(s.yearData?.parts || '0');
      const total = parseFloat(s.yearData?.total || '0');
      const isActive = parts > 0 || total > 0;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (gradeFilter !== "all") {
        const { grade } = calculateGrade(total);
        if (grade !== gradeFilter) return false;
      }
      if (partsFilter && parts < (parseFloat(partsFilter) || 0)) return false;
      return true;
    });
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const av = getSortValue(a, sortField);
        const bv = getSortValue(b, sortField);
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string, 'ar') : (av as number) - (bv as number);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return filtered;
  }, [students, selectedTeacher, nameFilter, statusFilter, gradeFilter, partsFilter, sortField, sortDirection, getSortValue]);

  const hasFilters = selectedTeacher !== "all" || nameFilter !== "" || statusFilter !== "all" || gradeFilter !== "all" || partsFilter !== "";

  const handlePrintFiltered = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = filteredStudents.map((s, i) => {
      const parts = parseFloat(s.yearData?.parts || '0');
      const totalScore = parseFloat(s.yearData?.total || '0');
      const isActive = parts > 0 || totalScore > 0;
      const { grade } = calculateGrade(totalScore);
      const prize = parseFloat(s.yearData?.prize || '0');
      const sp = parseFloat(s.yearData?.statusPrize || '0');
      return `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.teacher}</td>
        <td>${s.yearData?.baseHifz || '-'}</td><td>${s.yearData?.parts || '-'}</td>
        <td>${s.yearData?.totalHifz || '-'}</td><td>${s.yearData?.annual || '-'}</td>
        <td>${s.yearData?.recitation || '-'}</td><td>${s.yearData?.memorization || '-'}</td>
        <td>${totalScore || '-'}</td><td class="${isActive ? 'active' : 'inactive'}">${isActive ? 'نشط' : 'منقطع'}</td>
        <td>${grade || '-'}</td><td>${prize.toLocaleString()}</td><td>${sp.toLocaleString()}</td></tr>`;
    }).join('');
    const totalPrize = filteredStudents.reduce((s, x) => s + (parseFloat(x.yearData?.prize || '0')), 0);
    const totalSP = filteredStudents.reduce((s, x) => s + (parseFloat(x.yearData?.statusPrize || '0')), 0);
    w.document.write(`<html dir="rtl"><head><title>تقرير - ${currentYear}هـ</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Tajawal,'Segoe UI',Arial,sans-serif;padding:20px;color:#1a3a2a}
      .header{text-align:center;margin-bottom:20px;border-bottom:3px solid #2d7a52;padding-bottom:12px}
      .header img{height:80px;margin-bottom:8px}.header h1{font-size:20px;color:#2d7a52}.header h2{font-size:16px;color:#555}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#2d7a52;color:white;padding:6px 3px;border:1px solid #1a5a38}
      td{padding:5px 3px;border:1px solid #ccc;text-align:center}
      tr:nth-child(even){background:#f9fdfb}.total-row{background:#e8f5ee!important;font-weight:bold}
      .active{color:#16a34a;font-weight:bold}.inactive{color:#dc2626;font-weight:bold}
      @media print{@page{size:landscape;margin:10mm}}</style></head><body>
      <div class="header"><img src="${logo}"/><h1>مركز إنماء الأهلي الخيري</h1><h2>كشف المسابقة الرمضانية - ${currentYear}هـ</h2></div>
      <table><thead><tr><th>م</th><th>الاسم</th><th>المعلمة</th><th>الحفظ السابق</th><th>حفظ جديد</th>
      <th>الإجمالي</th><th>سنة</th><th>تلاوة</th><th>حفظ</th><th>المجموع</th><th>الحالة</th><th>التقدير</th>
      <th>المكافأة</th><th>المكافأة حسب الحالة</th></tr></thead><tbody>${rows}
      <tr class="total-row"><td colspan="12">إجمالي المكافآت</td><td>${totalPrize.toLocaleString()}</td><td>${totalSP.toLocaleString()}</td></tr>
      </tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <TableFilters
        teachers={teachers}
        selectedTeacher={selectedTeacher} onTeacherChange={setSelectedTeacher}
        nameFilter={nameFilter} onNameFilterChange={setNameFilter}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        gradeFilter={gradeFilter} onGradeFilterChange={setGradeFilter}
        partsFilter={partsFilter} onPartsFilterChange={setPartsFilter}
        onPrintFiltered={handlePrintFiltered} hasFilters={hasFilters}
      />
      <div className="overflow-x-auto rounded-lg border border-border shadow-lg">
        <table className="w-full border-collapse bg-card text-sm whitespace-nowrap table-fixed min-w-[1400px]">
          <TableHeader currentYear={currentYear} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
          <tbody>
            {filteredStudents.map((s, i) => (
              <TableRow key={`${s.id}-${currentYear}`} student={s} index={i + 1} currentYear={currentYear} onDelete={onDelete} onDirtyChange={onDirtyChange} />
            ))}
          </tbody>
        </table>
      </div>
      {filteredStudents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">لا توجد بيانات تطابق معايير البحث</div>
      )}
    </div>
  );
};
