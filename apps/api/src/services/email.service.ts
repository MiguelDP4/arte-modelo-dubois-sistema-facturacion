import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  meta?: Record<string, string>;
}

const mockOutbox: EmailMessage[] = [];

export function getMockOutbox(): readonly EmailMessage[] {
  return mockOutbox;
}

export function clearMockOutbox(): void {
  mockOutbox.length = 0;
}

async function sendViaResend(message: EmailMessage): Promise<void> {
  if (!env.resendApiKey) {
    throw new Error('RESEND_API_KEY no configurada.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Error enviando correo vía Resend (${response.status}): ${body}`);
  }
}

async function sendViaSmtp(message: EmailMessage): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth:
      env.smtpUser && env.smtpPass
        ? { user: env.smtpUser, pass: env.smtpPass }
        : undefined,
  });

  await transporter.sendMail({
    from: env.emailFrom,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.emailProvider === 'resend' && env.resendApiKey) {
    await sendViaResend(message);
    return;
  }

  if (env.emailProvider === 'smtp' && env.smtpUser && env.smtpPass) {
    await sendViaSmtp(message);
    return;
  }

  mockOutbox.push(message);
  if (!env.isTest) {
    console.info(
      `[EMAIL MOCK] Para: ${message.to} | Asunto: ${message.subject} | ${message.text}`,
    );
  }
}

function buildEmailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#ffe7c8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fdfaf6;border:1px solid #08042b;">
    <tr>
      <td style="background:#06005c;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold;">
        Arte Modelo Dubois
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="margin:0 0 12px 0;color:#08042b;font-size:18px;">${title}</h2>
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#f5d5b7;font-size:12px;color:#404040;">
        Sistema de Facturación y Pedidos B2B — Arte Modelo Dubois
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(params: {
  to: string;
  fullName: string;
  token: string;
}): Promise<string> {
  const verifyUrl = `${env.frontendUrl}/verificar-cuenta?token=${encodeURIComponent(params.token)}`;
  const html = buildEmailLayout(
    'Verifica tu correo electrónico',
    `<p>Hola <strong>${params.fullName}</strong>,</p>
     <p>Gracias por registrarte en el portal B2B de Arte Modelo Dubois. Haz clic en el siguiente botón para activar tu cuenta:</p>
     <p style="margin:24px 0;">
       <a href="${verifyUrl}" style="display:inline-block;background:#110b51;color:#ffffff;padding:12px 24px;text-decoration:none;font-weight:bold;">
         Verificar mi cuenta
       </a>
     </p>
     <p style="font-size:13px;color:#404040;">Este enlace expira en 24 horas. Si no solicitaste esta cuenta, puedes ignorar este correo.</p>`,
  );

  await sendEmail({
    to: params.to,
    subject: 'Verifica tu cuenta — Arte Modelo Dubois',
    html,
    text: `Hola ${params.fullName}, verifica tu cuenta en: ${verifyUrl}`,
    meta: { type: 'verification', token: params.token, url: verifyUrl },
  });

  return verifyUrl;
}

export async function sendInvitationEmail(params: {
  to: string;
  fullName: string;
  roleLabel: string;
  token: string;
}): Promise<string> {
  const inviteUrl = `${env.frontendUrl}/registro-invitado?token=${encodeURIComponent(params.token)}`;
  const html = buildEmailLayout(
    'Invitación a Arte Modelo Dubois',
    `<p>Hola <strong>${params.fullName}</strong>,</p>
     <p>Has sido invitado a unirte al sistema de Arte Modelo Dubois con el rol de <strong>${params.roleLabel}</strong>.</p>
     <p style="margin:24px 0;">
       <a href="${inviteUrl}" style="display:inline-block;background:#110b51;color:#ffffff;padding:12px 24px;text-decoration:none;font-weight:bold;">
         Completar registro
       </a>
     </p>
     <p style="font-size:13px;color:#404040;">Este enlace de invitación es válido por 72 horas.</p>`,
  );

  await sendEmail({
    to: params.to,
    subject: 'Invitación al portal — Arte Modelo Dubois',
    html,
    text: `Hola ${params.fullName}, completa tu registro (${params.roleLabel}) en: ${inviteUrl}`,
    meta: { type: 'invitation', token: params.token, url: inviteUrl },
  });

  return inviteUrl;
}
