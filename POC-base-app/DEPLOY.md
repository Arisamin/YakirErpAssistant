# מדריך פריסה לייצור — מערכת <CompNamePlaceHolder>

מדריך תמציתי-מעשי. לפירוט מלא ראה את מסמך "תוכנית מעבר לייצור".
הדוגמאות מבוססות על Render (שרת + PWA + מסד) באזור פרנקפורט (EU). ניתן להשתמש בכל ספק אחר.

## 0. לפני שמתחילים
- חשבון GitHub (מאגר פרטי), חשבון Render, וגישה לדומיין המיועד.
- הרץ `bash scripts/gen-secrets.sh` ושמור את שני הסודות במקום מאובטח.

## 1. העלאת הקוד ל-GitHub
```bash
cd <CompNamePlaceHolder>-app
git init && git add . && git commit -m "Initial system v1"
git remote add origin https://github.com/<ORG>/<REPO>.git
git push -u origin main
```
ודא שהמאגר **פרטי**. קבצי ‎.env‎ אינם נכללים (הם ב-‎.gitignore‎).

## 2. פריסה ב-Render (Blueprint)
1. ב-Render: **New → Blueprint** → חבר את המאגר. Render יזהה את `render.yaml`.
2. בעת ההקמה תתבקש להזין `ADMIN_PASSWORD` — סיסמה זמנית חזקה למנהל.
3. Render יקים אוטומטית: מסד נתונים, שרת API (יוצר את טבלאות המסד), ואתר ה-PWA.

## 3. זריעה ראשונית (חד-פעמית)
לאחר שהשרת עלה, ב-Render → שירות `poc-api` → **Shell**:
```bash
node dist/prisma/seed.js
```
זה יוצר תפקידים, מטריצת הרשאות ומשתמש המנהל. (בסביבת דמו נטענים גם נתוני דוגמה.)

## 4. דומיין ו-HTTPS
- הוסף רשומות DNS: `<CompSitePlaceHolder>` → שירות ה-API; `app.<CompDomainPlaceHolder>` → אתר ה-PWA.
- ב-Render הוסף את הדומיינים המותאמים (Custom Domains); SSL מונפק אוטומטית.
- ודא ש-`CORS_ORIGINS` (שרת) = `<AppUrlPlaceHolder>` ו-`VITE_API_URL` (PWA) = `<ApiUrlPlaceHolder>`.

## 5. בדיקה מהירה
- `https://<CompSitePlaceHolder>/api/health` → `{"status":"ok"}`
- כניסה ל-PWA עם המנהל → החלף סיסמה + הפעל 2FA מיד.

## 6. הרצה מקומית (לפיתוח)
```bash
# שרת
cd server && cp .env.example .env && npm install
npm run prisma:migrate && npm run db:seed && npm run dev
# PWA (בטרמינל נפרד)
cd web && cp .env.example .env && npm install && npm run dev
```

---
© 2026 <CompLTDNamePlaceHolder>. קניין רוחני בלעדי של <CompNamePlaceHolder>. סודי ומיועד למורשים בלבד.
