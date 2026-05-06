import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/PWARegister";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "المسابقة الرمضانية - مركز إنماء الأهلي الخيري" },
      { name: "description", content: "نظام إدارة المسابقة الرمضانية لتحفيظ القرآن الكريم" },
      { property: "og:title", content: "المسابقة الرمضانية - مركز إنماء الأهلي الخيري" },
      { name: "twitter:title", content: "المسابقة الرمضانية - مركز إنماء الأهلي الخيري" },
      { property: "og:description", content: "نظام إدارة المسابقة الرمضانية لتحفيظ القرآن الكريم" },
      { name: "twitter:description", content: "نظام إدارة المسابقة الرمضانية لتحفيظ القرآن الكريم" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/UIpOvPiyERaOgg8MbtmmPOYaqgF2/social-images/social-1777575472167-185564.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/UIpOvPiyERaOgg8MbtmmPOYaqgF2/social-images/social-1777575472167-185564.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#16a34a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "المسابقة" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">الصفحة غير موجودة</p>
        <a href="/" className="mt-6 inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md">العودة للرئيسية</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <PWARegister />
        <Toaster richColors position="top-center" />
        <Scripts />
      </body>
    </html>
  );
}
