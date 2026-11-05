import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { usuarios } from "../../db/schema.js";
import { readJson } from "../lib/shared.js";

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

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
      console.error("EMAIL_USER / EMAIL_PASS no están configuradas");
      return Response.json({ error: "El servicio de correo no está configurado" }, { status: 500 });
    }

    const code = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 5 * 60000); // 5 minutos

    await db
      .update(usuarios)
      .set({ verificationCode: code, codeExpires: expires })
      .where(eq(usuarios.id, user.id));

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.sendMail({
      from: emailUser,
      to: user.email,
      subject: "Worldnews - Tu código de verificación 2FA",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0275d8;">Worldnews Security</h2>
          <p>Hola <strong>${user.username}</strong>,</p>
          <p>Has solicitado iniciar sesión. Utiliza el siguiente código de 6 dígitos para completar tu acceso:</p>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
            <span style="font-size: 2rem; font-weight: bold; color: #0275d8; letter-spacing: 6px;">${code}</span>
          </div>
          <p style="font-size: 0.9rem; color: #666;">Este código expira en 5 minutos. Si no solicitaste este código, puedes ignorar este mensaje.</p>
        </div>
      `,
    });

    return Response.json({
      requires2FA: true,
      userId: user.id,
      message: "Código de verificación enviado a tu correo electrónico.",
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al enviar el correo de verificación" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/login" };
