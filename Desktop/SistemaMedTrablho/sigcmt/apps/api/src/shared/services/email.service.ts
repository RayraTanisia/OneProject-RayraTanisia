import nodemailer from 'nodemailer'

function createTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.warn('[email] SMTP não configurado — e-mails desativados.')
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
}

const FROM = process.env.SMTP_FROM || 'SIGCMT <noreply@sigcmt.com.br>'

async function sendMail(to: string, subject: string, html: string) {
  const transport = createTransport()
  if (!transport) return
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, html })
    console.info(`[email] Enviado para ${to} — messageId: ${info.messageId}`)
  } catch (err) {
    console.error('[email] Falha ao enviar:', err)
    throw err
  }
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  const transport = createTransport()
  if (!transport) return { ok: false, error: 'SMTP não configurado.' }
  try {
    await transport.verify()
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) }
  }
}

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:0}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#1e40af;padding:24px 32px}
  .header h1{color:#fff;margin:0;font-size:20px;letter-spacing:.5px}
  .body{padding:32px}
  .body p{color:#374151;line-height:1.6;margin:0 0 12px}
  .info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin:20px 0}
  .info-box p{margin:4px 0;font-size:14px;color:#1e3a8a}
  .info-box strong{display:inline-block;min-width:100px;color:#1e40af}
  .btn{display:inline-block;margin-top:16px;padding:12px 28px;background:#1e40af;color:#fff!important;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px}
  .footer{background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center}
</style>
</head>
<body><div class="wrap">${content}</div></body></html>`
}

export async function sendAppointmentConfirmation(opts: {
  to: string
  patientName: string
  doctorName: string
  date: string
  time: string
  type: string
  address?: string
}) {
  const html = baseLayout(`
    <div class="header"><h1>Consulta Confirmada</h1></div>
    <div class="body">
      <p>Olá, <strong>${opts.patientName}</strong>!</p>
      <p>Seu agendamento foi realizado com sucesso. Confira os detalhes abaixo:</p>
      <div class="info-box">
        <p><strong>Data:</strong> ${opts.date}</p>
        <p><strong>Horário:</strong> ${opts.time}</p>
        <p><strong>Médico:</strong> ${opts.doctorName}</p>
        <p><strong>Tipo:</strong> ${opts.type}</p>
        ${opts.address ? `<p><strong>Local:</strong> ${opts.address}</p>` : ''}
      </div>
      <p>Lembre-se de trazer seus documentos pessoais e chegar com <strong>10 minutos de antecedência</strong>.</p>
      <p>Em caso de dúvidas ou para reagendar, entre em contato conosco.</p>
    </div>
    <div class="footer">Este é um e-mail automático. Por favor, não responda.</div>
  `)
  await sendMail(opts.to, 'Agendamento Confirmado — SIGCMT', html)
}

export async function sendAppointmentReminder(opts: {
  to: string
  patientName: string
  doctorName: string
  date: string
  time: string
  type: string
}) {
  const html = baseLayout(`
    <div class="header"><h1>Lembrete de Consulta</h1></div>
    <div class="body">
      <p>Olá, <strong>${opts.patientName}</strong>!</p>
      <p>Lembramos que você possui uma consulta agendada para <strong>amanhã</strong>:</p>
      <div class="info-box">
        <p><strong>Data:</strong> ${opts.date}</p>
        <p><strong>Horário:</strong> ${opts.time}</p>
        <p><strong>Médico:</strong> ${opts.doctorName}</p>
        <p><strong>Tipo:</strong> ${opts.type}</p>
      </div>
      <p>Caso não possa comparecer, entre em contato com antecedência para evitar cobranças.</p>
    </div>
    <div class="footer">Este é um e-mail automático. Por favor, não responda.</div>
  `)
  await sendMail(opts.to, 'Lembrete: Consulta Amanhã — SIGCMT', html)
}

export async function sendAppointmentCancellation(opts: {
  to: string
  patientName: string
  doctorName: string
  date: string
  time: string
  reason: string
}) {
  const html = baseLayout(`
    <div class="header" style="background:#dc2626"><h1>Consulta Cancelada</h1></div>
    <div class="body">
      <p>Olá, <strong>${opts.patientName}</strong>!</p>
      <p>Infelizmente sua consulta foi cancelada.</p>
      <div class="info-box" style="background:#fef2f2;border-color:#fecaca">
        <p><strong>Data:</strong> ${opts.date}</p>
        <p><strong>Horário:</strong> ${opts.time}</p>
        <p><strong>Médico:</strong> ${opts.doctorName}</p>
        <p><strong>Motivo:</strong> ${opts.reason}</p>
      </div>
      <p>Entre em contato para reagendar seu atendimento.</p>
    </div>
    <div class="footer">Este é um e-mail automático. Por favor, não responda.</div>
  `)
  await sendMail(opts.to, 'Consulta Cancelada — SIGCMT', html)
}
