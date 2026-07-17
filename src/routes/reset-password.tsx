import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "إعادة تعيين كلمة المرور - المسابقة الرمضانية" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const hasRecoveryToken = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    return hash.get("type") === "recovery" || search.get("type") === "recovery";
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(Boolean(data.session));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const getFriendlyError = (message: string) => {
    if (message.includes("weak_password") || message.includes("known to be weak") || message.includes("pwned")) {
      return "كلمة المرور ضعيفة أو مستخدمة كثيراً. اختاري كلمة أقوى تحتوي أحرفاً كبيرة وصغيرة وأرقاماً ورمزاً خاصاً.";
    }
    if (message.includes("Password should be")) return "كلمة المرور قصيرة؛ يجب أن تكون 6 أحرف على الأقل ويفضل أن تكون أقوى.";
    return message;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح، سجّلي الدخول الآن");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذّر تغيير كلمة المرور";
      toast.error(getFriendlyError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/10" dir="rtl">
      <Card className="w-full max-w-md p-8 shadow-2xl border-primary/20">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="الشعار" className="h-20 mb-3" />
          <h1 className="text-2xl font-bold text-primary text-center">إعادة تعيين كلمة المرور</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">أدخلي كلمة مرور جديدة لحسابك</p>
        </div>

        {!hasRecoveryToken && !ready ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">افتحي هذه الصفحة من رابط إعادة التعيين المرسل إلى بريدك الإلكتروني.</p>
            <Button type="button" onClick={() => navigate({ to: "/auth" })} className="w-full">
              الرجوع لتسجيل الدخول
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور الجديدة</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input id="confirmPassword" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}