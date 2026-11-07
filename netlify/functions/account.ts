import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { tokensCuenta, usuarios } from "../../db/schema.js";
import { readJson } from "../lib/shared.js";
import { MailConfigError, emailFailureMessage, emailTemplate, escapeHtml, maskEmail, sendMail } from "../lib/mailer.js";

// Recuperación y cambio de datos de la cuenta mediante enlaces enviados por correo
//   POST /api/account/forgot          { email }                     -> envía el usuario + enlace para nueva contraseña
//   POST /api/account/request-change  { usuario_id, type }          -> type "password" | "email": enlace al correo actual
//   GET  /api/account/token?token=... -> valida el enlace y dice qué formulario mostrar
//   POST /api/account/reset-password  { token, password }
//   POST /api/account/change-email    { token, email }              -> envía un enlace de confirmación al correo nuevo
//   POST /api/account/confirm-email   { token }                     -> aplica el correo nuevo

type Tipo = "password_reset" | "email_change" | "email_confirm";

const LINK_MINUTES = 30;
const COOLDOWN_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function linkUrl(req: Request, token: string) {
  const origin = new URL(req.url).origin;
  return `${origin}/pages/account%20recovery.html?token=${token}`;
}

// Hay un enlace reciente sin usar del mismo tipo (evita enviar correos en bucle)
async function recentlySent(usuarioId: number, tipo: Tipo) {
  const [row] = await db
    .select({ id: tokensCuenta.id })
    .from(tokensCuenta)
    .where(
      and(
        eq(tokensCuenta.usuarioId, usuarioId),
        eq(tokensCuenta.tipo, tipo),
        isNull(tokensCuenta.usadoEn),
        gt(tokensCuenta.creadoEn, new Date(Date.now() - COOLDOWN_SECONDS * 1000))
      )
    );
  return Boolean(row);
}

async function createToken(usuarioId: number, tipo: Tipo, nuevoEmail: string | null = null) {
  // Un nuevo enlace anula los anteriores del mismo tipo
  await db
    .update(tokensCuenta)
    .set({ usadoEn: new Date() })
    .where(and(eq(tokensCuenta.usuarioId, usuarioId), eq(tokensCuenta.tipo, tipo), isNull(tokensCuenta.usadoEn)));

  const token = randomBytes(32).toString("hex");
  const [row] = await db
    .insert(tokensCuenta)
    .values({
      usuarioId,
      tipo,
      tokenHash: hashToken(token),
      nuevoEmail,
      expiraEn: new Date(Date.now() + LINK_MINUTES * 60000),
    })
    .returning({ id: tokensCuenta.id });
  return { token, id: row.id };
}

async function findValidToken(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await db
    .select({
      id: tokensCuenta.id,
      tipo: tokensCuenta.tipo,
      nuevoEmail: tokensCuenta.nuevoEmail,
      expiraEn: tokensCuenta.expiraEn,
      usadoEn: tokensCuenta.usadoEn,
      usuarioId: usuarios.id,
      username: usuarios.username,
      email: usuarios.email,
    })
    .from(tokensCuenta)
    .innerJoin(usuarios, eq(usuarios.id, tokensCuenta.usuarioId))
    .where(eq(tokensCuenta.tokenHash, hashToken(token)));
  if (!row || row.usadoEn || new Date(row.expiraEn) < new Date()) return null;
  return row;
}

// Marca el enlace como usado; devuelve false si otra petición lo usó antes
async function consumeToken(id: number) {
  const updated = await db
    .update(tokensCuenta)
    .set({ usadoEn: new Date() })
    .where(and(eq(tokensCuenta.id, id), isNull(tokensCuenta.usadoEn)))
    .returning({ id: tokensCuenta.id });
  return updated.length > 0;
}

async function emailTaken(email: string, exceptId: number) {
  const [row] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(sql`lower(${usuarios.email}) = ${email.toLowerCase()}`, ne(usuarios.id, exceptId)));
  return Boolean(row);
}

const invalidLink = () =>
  Response.json({ error: "El enlace no es válido o ya expiró. Solicita uno nuevo." }, { status: 400 });

function mailError(err: unknown) {
  return Response.json({ error: emailFailureMessage(err) }, { status: err instanceof MailConfigError ? 500 : 502 });
}

const expiryNote = `<p style="font-size: 0.9rem; color: #666;">Este enlace expira en ${LINK_MINUTES} minutos y solo se puede usar una vez. Si no solicitaste este cambio, puedes ignorar este mensaje: tu cuenta no se modificará.</p>`;

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/api\/account\/?/, "");

  try {
    // ---------- Validar enlace ----------
    if (action === "token" && req.method === "GET") {
      const row = await findValidToken(url.searchParams.get("token"));
      if (!row) return invalidLink();
      return Response.json({
        type: row.tipo,
        username: row.username,
        email: maskEmail(row.email),
        new_email: row.nuevoEmail ? maskEmail(row.nuevoEmail) : null,
      });
    }

    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await readJson(req);

    // ---------- ¿Olvidaste tu contraseña o usuario? ----------
    if (action === "forgot") {
      const email = String(body.email ?? "").trim();
      if (!EMAIL_RE.test(email)) {
        return Response.json({ error: "Introduce un correo electrónico válido" }, { status: 400 });
      }
      // La respuesta es la misma exista o no la cuenta, para no revelar qué correos están registrados
      const generic = Response.json({
        message: "Si existe una cuenta con ese correo, te enviamos un mensaje con tu usuario y un enlace para cambiar la contraseña.",
      });

      const [user] = await db
        .select()
        .from(usuarios)
        .where(sql`lower(${usuarios.email}) = ${email.toLowerCase()}`);
      if (!user || (await recentlySent(user.id, "password_reset"))) return generic;

      const { token } = await createToken(user.id, "password_reset");
      try {
        await sendMail(
          user.email,
          "Worldnews - Recupera tu cuenta",
          emailTemplate(
            "Worldnews - Recuperar cuenta",
            `<p>Recibimos una solicitud para recuperar el acceso a tu cuenta.</p>
             <p>Tu nombre de usuario es:</p>
             <div style="background-color: #f8f9fa; padding: 12px; text-align: center; border-radius: 6px; margin: 16px 0;">
               <span style="font-size: 1.3rem; font-weight: bold; color: #0275d8;">${escapeHtml(user.username)}</span>
             </div>
             <p>Si también olvidaste tu contraseña, puedes crear una nueva con este enlace:</p>`,
            { label: "Crear una nueva contraseña", url: linkUrl(req, token) },
            expiryNote
          )
        );
      } catch (err) {
        return mailError(err);
      }
      return generic;
    }

    // ---------- Cambio solicitado desde Profile Settings ----------
    if (action === "request-change") {
      const usuarioId = Number(body.usuario_id);
      const type = body.type === "email" ? "email" : body.type === "password" ? "password" : null;
      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
      }
      if (!type) return Response.json({ error: "Tipo de cambio no válido" }, { status: 400 });

      const [user] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
      if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

      const tipo: Tipo = type === "email" ? "email_change" : "password_reset";
      if (await recentlySent(user.id, tipo)) {
        return Response.json(
          { error: "Ya te enviamos un enlace hace un momento. Revisa tu correo o espera un minuto para pedir otro." },
          { status: 429 }
        );
      }

      const { token } = await createToken(user.id, tipo);
      const isEmail = type === "email";
      try {
        await sendMail(
          user.email,
          isEmail ? "Worldnews - Cambia tu correo electrónico" : "Worldnews - Cambia tu contraseña",
          emailTemplate(
            "Worldnews Security",
            `<p>Hola <strong>${escapeHtml(user.username)}</strong>,</p>
             <p>${
               isEmail
                 ? "Solicitaste cambiar el correo electrónico de tu cuenta. Usa este enlace para elegir el nuevo correo:"
                 : "Solicitaste cambiar la contraseña de tu cuenta. Usa este enlace para elegir una nueva contraseña:"
             }</p>`,
            { label: isEmail ? "Cambiar mi correo" : "Cambiar mi contraseña", url: linkUrl(req, token) },
            expiryNote
          )
        );
      } catch (err) {
        return mailError(err);
      }
      return Response.json({
        message: `Te enviamos un enlace a ${maskEmail(user.email)}. Ábrelo para continuar.`,
      });
    }

    // ---------- Guardar nueva contraseña ----------
    if (action === "reset-password") {
      const password = String(body.password ?? "");
      if (password.length < 6) {
        return Response.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
      }
      const row = await findValidToken(body.token);
      if (!row || row.tipo !== "password_reset") return invalidLink();
      if (!(await consumeToken(row.id))) return invalidLink();

      const passwordHash = await bcrypt.hash(password, 10);
      await db
        .update(usuarios)
        .set({ passwordHash, verificationCode: null, codeExpires: null })
        .where(eq(usuarios.id, row.usuarioId));
      return Response.json({ message: "Tu contraseña se cambió correctamente. Ya puedes iniciar sesión." });
    }

    // ---------- Elegir correo nuevo (envía confirmación al correo nuevo) ----------
    if (action === "change-email") {
      const email = String(body.email ?? "").trim();
      if (!EMAIL_RE.test(email) || email.length > 255) {
        return Response.json({ error: "Introduce un correo electrónico válido" }, { status: 400 });
      }
      const row = await findValidToken(body.token);
      if (!row || row.tipo !== "email_change") return invalidLink();
      if (email.toLowerCase() === row.email.toLowerCase()) {
        return Response.json({ error: "Ese ya es el correo de tu cuenta" }, { status: 400 });
      }
      if (await emailTaken(email, row.usuarioId)) {
        return Response.json({ error: "Ese correo ya está registrado en otra cuenta" }, { status: 400 });
      }

      const { token, id } = await createToken(row.usuarioId, "email_confirm", email);
      try {
        await sendMail(
          email,
          "Worldnews - Confirma tu nuevo correo",
          emailTemplate(
            "Worldnews Security",
            `<p>Hola <strong>${escapeHtml(row.username)}</strong>,</p>
             <p>Confirma que este será el nuevo correo electrónico de tu cuenta de Worldnews:</p>`,
            { label: "Confirmar mi nuevo correo", url: linkUrl(req, token) },
            expiryNote
          )
        );
      } catch (err) {
        // El correo no salió: se anula el enlace de confirmación y se mantiene el enlace original
        await consumeToken(id);
        return mailError(err);
      }
      await consumeToken(row.id);
      return Response.json({
        message: `Te enviamos un enlace de confirmación a ${maskEmail(email)}. Tu correo cambiará cuando lo abras.`,
      });
    }

    // ---------- Confirmar correo nuevo ----------
    if (action === "confirm-email") {
      const row = await findValidToken(body.token);
      if (!row || row.tipo !== "email_confirm" || !row.nuevoEmail) return invalidLink();
      if (await emailTaken(row.nuevoEmail, row.usuarioId)) {
        return Response.json({ error: "Ese correo ya está registrado en otra cuenta" }, { status: 400 });
      }
      if (!(await consumeToken(row.id))) return invalidLink();

      await db.update(usuarios).set({ email: row.nuevoEmail }).where(eq(usuarios.id, row.usuarioId));
      return Response.json({ message: `Listo. El correo de tu cuenta ahora es ${maskEmail(row.nuevoEmail)}.` });
    }
  } catch (err: any) {
    console.error(err);
    const cause = err?.cause ?? err;
    if (cause?.code === "23505") {
      return Response.json({ error: "Ese correo ya está registrado en otra cuenta" }, { status: 400 });
    }
    return Response.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = { path: "/api/account/*" };
