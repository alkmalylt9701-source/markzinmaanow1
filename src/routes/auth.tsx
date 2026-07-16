import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, LogIn, UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";
import { clearStoredAuthSession } from "@/utils/authCleanup";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول - المسابقة الرمضانية" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearStoredAuthSession();
  }, []);

  const resetLocalAuth = async () => {
    clearStoredAuthSession();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      clearStoredAuthSession();
    }
  };

  const getFriendlyAuthError = (message: string) => {
    if (message.includes("Failed to fetch")) {
      return "تعذّر الاتصال بخدمة الدخول. إن كنت تستخدم المعاينة فجرّب الرابط المنشور للتطبيق، أو أعد المحاولة بعد تحديث الصفحة";
    }
    if (message.includes("Invalid login")) return "البريد أو كلمة المرور غير صحيحة";
    if (message.includes("Email not confirmed")) return "يجب تأكيد البريد الإلكتروني أولاً ثم تسجيل الدخول";
    if (message.includes("User already registered")) return "هذا البريد مسجل مسبقاً، استخدم تسجيل الدخول";
    if (message.includes("Signup is disabled")) return "إنشاء الحسابات غير مفعّل حالياً";
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetLocalAuth();
      const normalizedEmail = email.trim();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح");
          navigate({ to: "/" });
        } else {
          toast.success("تم إنشاء الحساب. إن وصلت رسالة تأكيد للبريد، أكّدها ثم سجّل الدخول");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ";
      toast.error(getFriendlyAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/10" dir="rtl">
      <Card className="w-full max-w-md p-8 shadow-2xl border-primary/20">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="الشعار" className="h-20 mb-3" />
          <h1 className="text-2xl font-bold text-primary text-center">المسابقة الرمضانية</h1>
          <p className="text-sm text-muted-foreground mt-1">مركز إنماء الأهلي الخيري</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {mode === "login" ? <><LogIn className="h-4 w-4" /> دخول</> : <><UserPlus className="h-4 w-4" /> إنشاء حساب</>}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline">
            {mode === "login" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3 w-3" />
          <span>نظام إدارة المسابقة الرمضانية</span>
        </div>
      </Card>
    </div>
  );
}
