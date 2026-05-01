import { Student, HifzHistory, YearData } from "@/types/student";
import { supabase } from "@/integrations/supabase/client";

const defaultYearData = (): YearData => ({
  baseHifz: '0', totalHifz: '0', parts: '', annual: '', recitation: '',
  memorization: '', total: '0', grade: '', prize: '0', statusPrize: '', rank: '-',
  teacher: ''
});

const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

export const loadAllStudentsWithData = async (currentYear: string): Promise<Student[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const [studentsRes, historyRes, yearDataRes] = await Promise.all([
    supabase.from('students').select('*').eq('user_id', userId).order('id'),
    supabase.from('hifz_history').select('*').eq('user_id', userId),
    supabase.from('year_data').select('*').eq('user_id', userId).eq('year', currentYear),
  ]);

  const students = studentsRes.data || [];
  const historyMap: Record<number, HifzHistory> = {};
  (historyRes.data || []).forEach((row) => {
    if (!historyMap[row.student_id]) historyMap[row.student_id] = {};
    historyMap[row.student_id][row.year_key] = row.value;
  });

  const yearDataMap: Record<number, YearData> = {};
  (yearDataRes.data || []).forEach((row) => {
    yearDataMap[row.student_id] = {
      baseHifz: row.base_hifz, totalHifz: row.total_hifz, parts: row.parts,
      annual: row.annual, recitation: row.recitation, memorization: row.memorization,
      total: row.total, grade: row.grade, prize: row.prize,
      statusPrize: row.status_prize, rank: row.rank, teacher: row.teacher || '',
    };
  });

  return students.map((s) => ({
    id: s.id,
    name: s.name,
    teacher: yearDataMap[s.id]?.teacher || s.teacher || '',
    hifzHistory: historyMap[s.id] || {},
    yearData: yearDataMap[s.id] || defaultYearData(),
  }));
};

export const loadGlobalStudents = async (): Promise<Student[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from('students').select('id,name,teacher').eq('user_id', userId).order('id');
  return (data || []).map((s) => ({ id: s.id, name: s.name, teacher: s.teacher }));
};

export class DuplicateNameError extends Error {
  constructor() { super('اسم الطالبة موجود مسبقاً'); this.name = 'DuplicateNameError'; }
}

export const saveStudent = async (student: { id?: number; name: string; teacher: string }): Promise<number | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const name = (student.name || '').trim();

  if (student.id) {
    const { error } = await supabase.from('students').update({ name, teacher: student.teacher }).eq('id', student.id).eq('user_id', userId);
    if (error) {
      if (error.code === '23505') throw new DuplicateNameError();
      console.error(error); return null;
    }
    return student.id;
  } else {
    if (!name) {
      const { data, error } = await supabase.from('students').insert({ user_id: userId, name: '', teacher: student.teacher || '' }).select('id').single();
      if (error) { console.error(error); return null; }
      return data.id;
    }
    const { data, error } = await supabase.from('students').insert({ user_id: userId, name, teacher: student.teacher || '' }).select('id').single();
    if (error) {
      if (error.code === '23505') throw new DuplicateNameError();
      console.error(error); return null;
    }
    return data.id;
  }
};

export const deleteStudent = async (id: number) => {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('students').delete().eq('id', id).eq('user_id', userId);
};

export const deleteAllStudents = async () => {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('students').delete().eq('user_id', userId);
};

export const saveHifzHistory = async (studentId: number, history: HifzHistory) => {
  const userId = await getUserId();
  if (!userId) return;
  const rows = Object.entries(history).map(([year_key, value]) => ({
    user_id: userId, student_id: studentId, year_key, value: value || '0',
  }));
  if (rows.length === 0) return;
  await supabase.from('hifz_history').upsert(rows, { onConflict: 'student_id,year_key' });
};

export const loadHifzHistory = async (studentId: number): Promise<HifzHistory> => {
  const userId = await getUserId();
  if (!userId) return {};
  const { data } = await supabase.from('hifz_history').select('year_key,value').eq('user_id', userId).eq('student_id', studentId);
  const out: HifzHistory = {};
  (data || []).forEach((r) => { out[r.year_key] = r.value; });
  return out;
};

export const saveYearData = async (year: string, studentId: number, d: YearData) => {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('year_data').upsert({
    user_id: userId, student_id: studentId, year,
    base_hifz: d.baseHifz, total_hifz: d.totalHifz, parts: d.parts,
    annual: d.annual, recitation: d.recitation, memorization: d.memorization,
    total: d.total, grade: d.grade, prize: d.prize,
    status_prize: d.statusPrize, rank: d.rank, teacher: d.teacher || '',
  }, { onConflict: 'student_id,year' });

  // مزامنة الأجزاء الجديدة لهذا العام في تاريخ الحفظ ليُحسب تراكمياً للأعوام التالية
  const partsValue = (parseFloat(d.parts) || 0).toString();
  await supabase.from('hifz_history').upsert({
    user_id: userId, student_id: studentId, year_key: `h${year}`, value: partsValue,
  }, { onConflict: 'student_id,year_key' });
};

export const loadYearData = async (year: string, studentId: number): Promise<YearData> => {
  const userId = await getUserId();
  if (!userId) return defaultYearData();
  const { data } = await supabase.from('year_data').select('*').eq('user_id', userId).eq('student_id', studentId).eq('year', year).maybeSingle();
  if (!data) return defaultYearData();
  return {
    baseHifz: data.base_hifz, totalHifz: data.total_hifz, parts: data.parts,
    annual: data.annual, recitation: data.recitation, memorization: data.memorization,
    total: data.total, grade: data.grade, prize: data.prize,
    statusPrize: data.status_prize, rank: data.rank, teacher: data.teacher || '',
  };
};

export const getActiveYear = async (): Promise<string> => {
  const userId = await getUserId();
  if (!userId) return '1447';
  const { data } = await supabase.from('user_settings').select('active_year').eq('user_id', userId).maybeSingle();
  return data?.active_year || '1447';
};

export const setActiveYear = async (year: string) => {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('user_settings').upsert({ user_id: userId, active_year: year }, { onConflict: 'user_id' });
};
