import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { db } from "../../db/index.js";
import { usuarios } from "../../db/schema.js";
import { readJson } from "../lib/shared.js";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { username, password, email } = await readJson(req);
  if (!username || !password || !email) {
    return Response.json({ error: "Usuario, correo y contraseña son obligatorios" }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    await db.insert(usuarios).values({ username, passwordHash, email });
    return Response.json({ message: "Usuario registrado con éxito" }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    const cause = err?.cause ?? err;
    if (cause?.code === "23505") {
      return Response.json({ error: "El usuario o el correo ya están registrados" }, { status: 400 });
    }
    return Response.json({ error: "Error al registrar el usuario" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/register" };
