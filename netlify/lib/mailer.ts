import nodemailer from "nodemailer";

// Envío de correos con Gmail (EMAIL_USER / EMAIL_PASS)

export class MailConfigError extends Error {}

export function emailFailureMessage(err: any) {
  if (err instanceof MailConfigError) return "El servicio de correo no está configurado";
  const authFailed = err?.code === "EAUTH" || err?.responseCode === 535;
  return authFailed
    ? "Gmail rechazó las credenciales de correo (revisa EMAIL_USER y la contraseña de aplicación EMAIL_PASS)"
    : "No se pudo enviar el correo. Inténtalo de nuevo.";
}

export async function sendMail(to: string, subject: string, html: string) {
  const emailUser = process.env.EMAIL_USER?.trim();
  // Las contraseñas de aplicación de Gmail se muestran con espacios; se eliminan por si se copiaron así
  const emailPass = process.env.EMAIL_PASS?.replace(/\s+/g, "");
  if (!emailUser || !emailPass) {
    console.error("EMAIL_USER / EMAIL_PASS no están configuradas");
    throw new MailConfigError("Email not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({ from: `"Worldnews" <${emailUser}>`, to, subject, html });
  } catch (err: any) {
    console.error("Error de Gmail al enviar el correo:", err?.code, err?.responseCode, err?.message);
    throw err;
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

// Plantilla con el mismo estilo que el correo del código 2FA
export function emailTemplate(
  title: string,
  bodyHtml: string,
  button?: { label: string; url: string },
  footerHtml = ""
) {
  const buttonHtml = button
    ? `<div style="text-align: center; margin: 24px 0;">
         <a href="${button.url}" style="background-color: #0275d8; color: #ffffff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${button.label}</a>
       </div>
       <p style="font-size: 0.8rem; color: #888; word-break: break-all;">Si el botón no funciona, copia este enlace en tu navegador:<br>${button.url}</p>`
    : "";
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0275d8;">${title}</h2>
      ${bodyHtml}
      ${buttonHtml}
      ${footerHtml}
    </div>
  `;
}

// "angel@gmail.com" -> "an•••@gmail.com"
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}•••@${domain}`;
}
