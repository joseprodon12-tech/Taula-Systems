import type { Restaurant, Reservation, NotificationKind, NotificationResult } from '../types'
import { buildEmailTemplate } from '../templates'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
  fromName: string
  replyTo?: string
}

export async function sendEmail(
  restaurant: Restaurant,
  reservation: Reservation,
  kind: NotificationKind
): Promise<NotificationResult> {
  const email = reservation.customer_email!
  const { subject, html, text } = buildEmailTemplate(restaurant, reservation, kind)
  const fromName = restaurant.name
  const replyTo = restaurant.notification_email_from ?? process.env.EMAIL_FROM_ADDRESS

  await dispatchEmail({ to: email, subject, html, text, fromName, replyTo })
  return { sent: true }
}

async function dispatchEmail(params: SendEmailParams): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? 'brevo'

  switch (provider) {
    case 'brevo':
      return sendViaBrevo(params)
    case 'ses':
      return sendViaSES(params)
    case 'gmail-dev':
      return sendViaGmailDev(params)
    default:
      throw new Error(`EMAIL_PROVIDER desconegut: ${provider}`)
  }
}

async function sendViaBrevo(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY no configurada')

  const senderEmail = process.env.EMAIL_FROM_ADDRESS
  if (!senderEmail) throw new Error('EMAIL_FROM_ADDRESS no configurada')

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: params.fromName, email: senderEmail },
      to: [{ email: params.to }],
      replyTo: params.replyTo ? { email: params.replyTo } : undefined,
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo error ${res.status}: ${body}`)
  }
}

async function sendViaSES(_params: SendEmailParams): Promise<void> {
  // SES via @aws-sdk/client-ses — implementar quan es migrï de Brevo
  throw new Error('SES: not implemented yet')
}

async function sendViaGmailDev(params: SendEmailParams): Promise<void> {
  // Gmail SMTP — NOMÉS per a proves locals, mai producció amb dades reals
  // nodemailer no és una dependència del projecte; instal·la-la localment si cal
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const nodemailer = require('nodemailer') as any
  const user = process.env.GMAIL_DEV_USER
  const pass = process.env.GMAIL_DEV_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_DEV_USER o GMAIL_DEV_APP_PASSWORD no configurats')

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  await transporter.sendMail({
    from: `"${params.fromName}" <${user}>`,
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
    text: params.text,
  })
}
