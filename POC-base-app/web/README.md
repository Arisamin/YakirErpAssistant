# אפליקציית PWA — <CompNamePlaceHolder>

ממשק המשתמש של המערכת: React + TypeScript + Vite, כאפליקציית PWA (ניתנת להתקנה במחשב ובנייד).

## הרצה מקומית

```bash
cd web
cp .env.example .env      # ודא ש-VITE_API_URL מצביע לשרת (ברירת מחדל: localhost:4000)
npm install
npm run dev               # http://localhost:5173
```

יש להריץ תחילה את השרת (תיקיית `server`). מתחברים עם משתמש שנוצר בזריעה
(למשל `<AdminMailPlaceHolder>`).

## מה כלול (שלב 2)

- **מסך כניסה מאובטח** — כולל שדה אימות דו-שלבי (מופיע אם 2FA מופעל).
- **ניהול טוקנים** — access + refresh, עם חידוש אוטומטי.
- **תפריט לפי הרשאות** — מוצגים רק המודולים שלמשתמש יש בהם הרשאת צפייה (נטען מ-`/api/auth/me`).
- **סקירת פרויקטים** — נטענת מהשרת דרך `/api/projects`.
- **PWA** — manifest, service worker ואייקונים; ניתנת להתקנה כאפליקציה.

## בנייה לייצור

```bash
npm run build     # יוצר dist/ סטטי
npm run preview   # תצוגה מקומית של הבנייה
```

את תוכן `dist/` מארחים כאתר סטטי (Netlify / Vercel / Cloudflare Pages / שרת nginx),
עם `VITE_API_URL` שמצביע לכתובת ה-API בייצור.

---
© 2026 <CompLTDNamePlaceHolder>. קניין רוחני בלעדי של <CompNamePlaceHolder>. סודי ומיועד למורשים בלבד.
