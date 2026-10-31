# שרת אתניב — תמונת ייצור (multi-stage)
# שלב בנייה: מתקין הכל, מייצר Prisma Client ומקמפל TypeScript
FROM node:22-slim AS build
WORKDIR /app
# openssl נדרש ל-Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# שלב ריצה: תמונה רזה עם תלויות ייצור בלבד
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
# הקוד המקומפל + ה-Prisma Client שנוצר בשלב הבנייה + הסכמה למיגרציות
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
EXPOSE 4000
# יוצר/מסנכרן את טבלאות המסד מהסכמה (db push) ואז מפעיל את השרת.
# זריעה ראשונית (חד-פעמית) מריצים ידנית ב-Shell: node dist/prisma/seed.js
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/server.js"]
