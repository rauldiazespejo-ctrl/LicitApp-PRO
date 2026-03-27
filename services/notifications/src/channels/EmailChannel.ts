import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import { logger } from '../config/logger';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

const TEMPLATES = {
  newTender: Handlebars.compile(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
  .container{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px}
  .header p{color:#bfdbfe;margin:8px 0 0;font-size:14px}
  .body{padding:32px}
  .tender-card{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin-bottom:20px}
  .tender-card h2{margin:0 0 8px;color:#0c4a6e;font-size:16px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
  .badge-source{background:#dbeafe;color:#1e40af}
  .badge-status{background:#d1fae5;color:#065f46}
  .meta{margin:12px 0;font-size:13px;color:#475569}
  .meta span{margin-right:16px}
  .amount{font-size:18px;font-weight:700;color:#065f46;margin:8px 0}
  .btn{display:inline-block;background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px}
  .footer{background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Nueva Licitación Detectada</h1>
    <p>Tu alerta "{{alertName}}" tuvo coincidencias</p>
  </div>
  <div class="body">
    {{#each tenders}}
    <div class="tender-card">
      <div>
        <span class="badge badge-source">{{source}}</span>
        <span class="badge badge-status" style="margin-left:6px">{{status}}</span>
      </div>
      <h2>{{title}}</h2>
      <p style="color:#64748b;font-size:13px;margin:8px 0">{{description}}</p>
      <div class="meta">
        <span>🏢 {{buyer.name}}</span>
        {{#if closingDate}}<span>⏰ Cierre: {{closingDate}}</span>{{/if}}
      </div>
      {{#if budget}}<div class="amount">💰 {{budget}}</div>{{/if}}
      <a href="{{detailUrl}}" class="btn">Ver licitación</a>
    </div>
    {{/each}}
  </div>
  <div class="footer">
    <p>licitapp Chile &mdash; Sistema Unificado</p>
    <p><a href="{{unsubscribeUrl}}" style="color:#94a3b8">Desuscribirse de estas alertas</a></p>
  </div>
</div>
</body></html>`),

  emailVerification: Handlebars.compile(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
  .container{max-width:520px;margin:48px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#1e40af;padding:32px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:20px}
  .body{padding:40px;text-align:center}
  .code{font-size:40px;font-weight:800;letter-spacing:8px;color:#1e40af;background:#eff6ff;border-radius:8px;padding:16px 32px;display:inline-block;margin:24px 0}
  .btn{display:inline-block;background:#1d4ed8;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px}
  .footer{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>Verificación de Email</h1></div>
  <div class="body">
    <p style="color:#475569">Hola {{name}}, usa este código para verificar tu cuenta:</p>
    <div class="code">{{code}}</div>
    <p style="color:#94a3b8;font-size:13px">Expira en 15 minutos</p>
    <a href="{{verifyUrl}}" class="btn">Verificar Email</a>
  </div>
  <div class="footer"><p>licitapp Chile</p></div>
</div>
</body></html>`),

  closingAlert: Handlebars.compile(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
  .container{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#92400e,#f59e0b);padding:32px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px}
  .body{padding:32px}
  .alert-row{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #fef3c7;background:#fffbeb}
  .days-badge{background:#f59e0b;color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}
  .footer{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head>
<body>
<div class="container">
  <div class="header"><h1>⚠️ licitapp por Vencer</h1></div>
  <div class="body">
    <p style="color:#475569">Las siguientes licitapp cierran pronto:</p>
    {{#each tenders}}
    <div class="alert-row">
      <div>
        <strong style="color:#0c4a6e">{{title}}</strong><br>
        <span style="font-size:12px;color:#64748b">{{source}} &mdash; {{buyer}}</span>
      </div>
      <span class="days-badge">{{daysLeft}}d</span>
    </div>
    {{/each}}
  </div>
  <div class="footer"><p>licitapp Chile</p></div>
</div>
</body></html>`),
};

export type TemplateName = keyof typeof TEMPLATES;

class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }
    return this.transporter;
  }

  async send(payload: EmailPayload): Promise<void> {
    const transporter = this.getTransporter();
    const info = await transporter.sendMail({
      from: payload.from ?? `"licitapp Chile" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    logger.info(`[EMAIL] Sent to ${payload.to}: ${info.messageId}`);
  }

  async sendTemplate<T extends TemplateName>(
    templateName: T,
    to: string | string[],
    subject: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const template = TEMPLATES[templateName];
    const html = template(data);
    await this.send({ to, subject, html });
  }

  async verify(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      return true;
    } catch {
      return false;
    }
  }
}

export const emailService = new EmailService();
