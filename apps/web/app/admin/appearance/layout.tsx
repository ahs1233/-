import { AppearanceTabs } from "./_tabs";

// شريط تبويبات المظهر فوق كلّ المحرّرات (الألوان/التخطيط/الأسواق/المحافظات/الإعلانات).
export default function AppearanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AppearanceTabs />
      {children}
    </div>
  );
}
