# שרת אתניב — מערכת ניהול פרויקטלי-פיננסי

שרת ה-API של המערכת: Node.js + TypeScript + Express + Prisma + PostgreSQL.
כולל כניסה מאובטחת (JWT), הצפנת סיסמאות, תשתית אימות דו-שלבי (2FA), ואכיפת הרשאות (RBAC) בשרת.

## דרישות מקדימות

- Node.js 20+‎
- PostgreSQL 14+‎ (מקומי לפיתוח, או מסד מנוהל בענן לייצור)

## התקנה והרצה מקומית

```bash
cd server
cp .env.example .env          # ערוך את הסודות ומחרוזת החיבור
npm install
npm run prisma:generate       # יוצר את Prisma Client
npm run prisma:migrate        # יוצר את הטבלאות במסד
npm run db:seed               # זורע תפקידים, הרשאות, מנהל ופרויקטים
npm run dev                   # מריץ את השרת על http://localhost:4000
```

בדיקת חיים: `GET http://localhost:4000/api/health`

## נתיבי API עיקריים (שלב 1)

| נתיב | תיאור | הרשאה |
|---|---|---|
| `POST /api/auth/login` | כניסה (email, password, token אופציונלי ל-2FA) | ציבורי |
| `POST /api/auth/refresh` | חידוש טוקן גישה | ציבורי |
| `GET /api/auth/me` | פרטי המשתמש + ההרשאות שלו | מחובר |
| `POST /api/auth/2fa/setup` · `/2fa/enable` | הגדרת אימות דו-שלבי | מחובר |
| `GET/POST /api/auth/users` | ניהול משתמשים | מודול "ניהול הרשאות" |
| `GET /api/projects` | רשימת פרויקטים | צפייה ב"סקירת פרויקטים" |
| `POST/PUT/DELETE /api/projects` | ניהול פרויקטים | כתיבה/מחיקה ב"ייבוא נתונים" |

## אבטחה שכבר מוטמעת

- **הצפנת סיסמאות** — bcrypt (עלות 12), אף פעם לא נשמרות כטקסט גלוי.
- **JWT** — טוקן גישה קצר-מועד + refresh token.
- **RBAC בשרת** — כל נתיב נבדק מול מטריצת ההרשאות במסד; אי אפשר לעקוף מהממשק.
- **אימות דו-שלבי (TOTP)** — תשתית מוכנה (setup/enable/verify).
- **Rate limiting** — הגנה מפני ניחוש סיסמאות בנתיבי האימות.
- **Helmet + CORS** — כותרות אבטחה והגבלת מקורות.
- **יומן ביקורת** — כל פעולה משמעותית נרשמת (מי, מה, מתי, כתובת IP).

## פריסה אצל ספק אירוח (שלב הייצור)

1. **מסד נתונים מנוהל** — פתח PostgreSQL מנוהל (למשל Neon, Supabase, או Render Postgres). העתק את מחרוזת החיבור ל-`DATABASE_URL`.
2. **סודות** — צור ערכים אקראיים חזקים ל-`JWT_ACCESS_SECRET` ו-`JWT_REFRESH_SECRET` (`openssl rand -base64 48`).
3. **אירוח השרת** — פרוס דרך ה-`Dockerfile` (Render / Railway / Fly.io) או כשירות Node. הפקודה מריצה `prisma migrate deploy` ואז את השרת.
4. **HTTPS** — ספקי האירוח מספקים תעודת SSL אוטומטית. ודא שכל התעבורה מוצפנת.
5. **דומיין** — חבר דומיין ייעודי (למשל `api.etaniv.co.il`).
6. **CORS** — עדכן את `CORS_ORIGINS` לכתובת ה-PWA בייצור.

---
© 2026 אתניב ב.י בע"מ. קוד זה קניין רוחני בלעדי של אתניב. סודי ומיועד למורשים בלבד.
