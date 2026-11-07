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
