import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { usuarios } from "../../db/schema.js";
import { readJson } from "../lib/shared.js";
import { MailConfigError, emailFailureMessage, emailTemplate, escapeHtml, sendMail } from "../lib/mailer.js";

// Paso 1: valida credenciales y envía el código 2FA por correo
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { username, password } = await readJson(req);
  if (!username || !password) {
    return Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 400 });
  }

  try {
    const [user] = await db.select().from(usuarios).where(eq(usuarios.username, username));
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      return Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 400 });
    }

    const code = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 5 * 60000); // 5 minutos

    await db
      .update(usuarios)
      .set({ verificationCode: code, codeExpires: expires })
      .where(eq(usuarios.id, user.id));

    try {
      await sendCode(user.email, user.username, code);
    } catch (mailErr: any) {
      const status = mailErr instanceof MailConfigError ? 500 : 502;
      return Response.json({ error: emailFailureMessage(mailErr) }, { status });
    }

    return Response.json({
      requires2FA: true,
      userId: user.id,
      message: "Código de verificación enviado a tu correo electrónico.",
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al iniciar sesión" }, { status: 500 });
  }
};

async function sendCode(to: string, username: string, code: string) {
  await sendMail(
    to,
    "Worldnews - Tu código de verificación 2FA",
    emailTemplate(
      "Worldnews Security",
      `<p>Hola <strong>${escapeHtml(username)}</strong>,</p>
       <p>Has solicitado iniciar sesión. Utiliza el siguiente código de 6 dígitos para completar tu acceso:</p>
       <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
         <span style="font-size: 2rem; font-weight: bold; color: #0275d8; letter-spacing: 6px;">${code}</span>
       </div>
       <p style="font-size: 0.9rem; color: #666;">Este código expira en 5 minutos. Si no solicitaste este código, puedes ignorar este mensaje.</p>`
    )
  );
}

export const config: Config = { path: "/api/login" };
