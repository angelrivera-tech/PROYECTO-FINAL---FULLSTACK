import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";
import { readJson } from "../lib/shared.js";
import { createSessionToken, isAdminUsername } from "../lib/session.js";

// Paso 2: valida el código de 6 dígitos
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { userId, code } = await readJson(req);
  const id = Number(userId);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 400 });
  }

  try {
    const [user] = await db.select().from(usuarios).where(eq(usuarios.id, id));
    if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 400 });

    if (
      !user.verificationCode ||
      user.verificationCode !== String(code) ||
      !user.codeExpires ||
      new Date(user.codeExpires) < new Date()
    ) {
      return Response.json({ error: "Código inválido o expirado" }, { status: 400 });
    }

    await db
      .update(usuarios)
      .set({ verificationCode: null, codeExpires: null })
      .where(eq(usuarios.id, id));

    return Response.json({
      success: true,
      message: "¡Login exitoso!",
      username: user.username,
      userId: user.id,
      // Token firmado para las acciones que necesitan una sesión verificada (panel de administración)
      sessionToken: await createSessionToken(user.id),
      isAdmin: isAdminUsername(user.username),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al verificar el código" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/verify-2fa" };
