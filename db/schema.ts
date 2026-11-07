import { pgTable, serial, varchar, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// Tabla de Usuarios
export const usuarios = pgTable("usuarios", {
  id: serial().primaryKey(),
  username: varchar({ length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  verificationCode: varchar("verification_code", { length: 10 }),
  codeExpires: timestamp("code_expires"),
});

// Tabla de Articulos
export const articulos = pgTable("articulos", {
  id: serial().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 100 }).notNull(),
  imageUrl: text("image_url"),
  content: text().notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  fechaPublicacion: timestamp("fecha_publicacion").defaultNow(),
});

// Artículos guardados (pin) por cada usuario para leer después
export const articulosGuardados = pgTable(
  "articulos_guardados",
  {
    id: serial().primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    articuloId: integer("articulo_id")
      .notNull()
      .references(() => articulos.id, { onDelete: "cascade" }),
    fechaGuardado: timestamp("fecha_guardado").defaultNow(),
  },
  (t) => [unique("articulos_guardados_usuario_articulo_key").on(t.usuarioId, t.articuloId)]
);

// Enlaces de un solo uso enviados por correo para recuperar o cambiar datos de la cuenta
//   password_reset -> restablecer la contraseña
//   email_change   -> enlace al correo actual para elegir un correo nuevo
//   email_confirm  -> enlace al correo nuevo para confirmarlo
export const tokensCuenta = pgTable("tokens_cuenta", {
  id: serial().primaryKey(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  tipo: varchar({ length: 30 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  nuevoEmail: varchar("nuevo_email", { length: 255 }),
  expiraEn: timestamp("expira_en").notNull(),
  usadoEn: timestamp("usado_en"),
  creadoEn: timestamp("creado_en").defaultNow().notNull(),
});
