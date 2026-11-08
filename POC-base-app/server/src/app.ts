import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './env';
import { authRouter } from './modules/auth/auth.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { suppliersRouter, expenseTypesRouter } from './modules/suppliers/suppliers.routes';
import { supplierInvoicesRouter } from './modules/supplierInvoices/invoices.routes';
import { customersRouter, contractsRouter } from './modules/contracts/contracts.routes';
import { billingDocsRouter } from './modules/billingDocs/billingDocs.routes';
import { workersRouter, workdaysRouter } from './modules/labor/labor.routes';
import { overviewRouter } from './modules/overview/overview.routes';
import { collectionsRouter } from './modules/collections/collections.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { importRouter } from './modules/import/import.routes';
import { invoiceFieldSettingsRouter, orgSettingsRouter } from './modules/settings/settings.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { hashavshevetRouter } from './modules/hashavshevet/hashavshevet.routes';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // מאחורי reverse proxy של ספק האירוח
  app.use(helmet()); // כותרות אבטחה
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(pinoHttp({ level: env.nodeEnv === 'production' ? 'info' : 'debug' }));

  // הגבלת קצב על נתיבי אימות — הגנה מפני ניחוש סיסמאות
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.' },
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/expense-types', expenseTypesRouter);
  app.use('/api/supplier-invoices', supplierInvoicesRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/contracts', contractsRouter);
  app.use('/api/billing-docs', billingDocsRouter);
  app.use('/api/workers', workersRouter);
  app.use('/api/workdays', workdaysRouter);
  app.use('/api/overview', overviewRouter);
  app.use('/api/collections', collectionsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/invoice-field-settings', invoiceFieldSettingsRouter);
  app.use('/api/org-settings', orgSettingsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/hashavshevet', hashavshevetRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
