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
import { registerServiceWorker } from "@/registerServiceWorker";

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
  const [showDebug, setShowDebug] = useState(false);

  // لم يعد يتم مسح الجلسة تلقائياً عند تحميل صفحة الدخول لتجنّب خلع الجلسات غير المقصود
  useEffect(() => {
    // clearStoredAuthSession(); // يمكنك إعادة تفعيلها هنا إن رغبت
  }, []);

  // سجّل الـ Service Worker عند تحميل صفحة المصادقة (إذا كانت مدعومة)
  useEffect(() => {
    try { registerServiceWorker(); } catch (e) { console.warn('SW register failed', e); }
  }, []);

  const resetLocalAuth = async () => {
    clearStoredAuthSession();
    try {
      await (supabase.auth as any).signOut?.({ scope: "local" });
    } catch {
      clearStoredAuthSession();
    }
  };

  const getFriendlyAuthError = (message: string) => {
    if (message.includes("Failed to fetch")) {
      return "تعذّر الاتصال بخدمة الدخول. تأكد من إعداد متغيّرات البيئة وتهيئة Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY).";
    }
    if (message.includes("Invalid login")) return "البريد أو كلمة المرور غير صحيحة";
    if (message.includes("Email not confirmed")) return "يجب تأكيد البريد الإلكتروني أولاً ثم تسجيل الدخول";
    if (message.includes("User already registered")) return "ه��ا البريد مسجل مسبقاً، استخدم تسجيل الدخول";
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
        const { data, error } = await (supabase.auth as any).signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (error) throw error;

        if (data?.session) {
          toast.success("تم إنشاء الحساب وتسجيل الدخول بنجاح");
          navigate({ to: "/" });
        } else {
          toast.success("تم إنشاء الحساب. إن وصلت رسالة تأكيد للبريد، أكّدها ثم سجّل الدخول");
          setMode("login");
        }
      } else {
        const { data, error } = await (supabase.auth as any).signInWithPassword({ email: normalizedEmail, password });

        if (error) throw error;

        if (data?.session || data?.user) {
          toast.success("تم تسجيل الدخول بنجاح");
          navigate({ to: "/" });
        } else {
          toast.error("لم يتم تسجيل الدخول. تحقق من البريد وكلمة المرور أو حاول إعادة التحميل.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      toast.error(getFriendlyAuthError(msg));
      if (showDebug) console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  // زر "نسيت كلمة المرور" — يرسل رسالة إعادة ضبط كلمة المرور
  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("أدخل بريدك الإلكتروني أولاً لإرسال رابط إعادة الضبط");
      return;
    }
    setLoading(true);
    try {
      const authAny = supabase.auth as any;
      // حاول استخدام دالة resetPasswordForEmail إذا كانت متاحة في نسخة SDK
      if (typeof authAny.resetPasswordForEmail === "function") {
        const res = await authAny.resetPasswordForEmail(trimmed, { redirectTo: window.location.origin });
        if (res?.error) throw res.error;
        toast.success("تم إرسال رابط إعادة ضبط كلمة المرور إلى بريدك (إن كان مسجلاً)");
      } else if (typeof authAny.api?.resetPasswordForEmail === "function") {
        const res = await authAny.api.resetPasswordForEmail(trimmed);
        if (res?.error) throw res.error;
        toast.success("تم إرسال رابط إعادة ضبط كلمة المرور إلى بريدك (إن كان مسجلاً)");
      } else {
        // كخطة احتياطية، نستخدم واجهة REST العامة لإرسال طلب الاسترداد
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !apiKey) {
          throw new Error("Missing Supabase URL or API key for password reset fallback");
        }
        const resp = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/recover`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ email: trimmed }),
        });
        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`Password reset failed: ${resp.status} ${body}`);
        }
        toast.success("تم إرسال رابط إعادة ضبط كلمة المرور إلى بريدك (إن كان مسجلاً)");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل إرسال طلب إعادة الضبط";
      toast.error(getFriendlyAuthError(msg));
      if (showDebug) console.error("Reset password error:", err);
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

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1 gap-2">
              {mode === "login" ? <><LogIn className="h-4 w-4" /> دخول</> : <><UserPlus className="h-4 w-4" /> إنشاء حساب</>}
            </Button>
            <Button type="button" variant="ghost" onClick={handleForgotPassword} disabled={loading} className="gap-2">
              نسيت كلمة المرور؟
            </Button>
          </div>
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
