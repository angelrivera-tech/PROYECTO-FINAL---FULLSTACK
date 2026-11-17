# Arquitectura de Worldnews

## Visión general
Worldnews es una aplicación web full stack alojada por completo en Netlify:

| Capa | Tecnología | Carpeta |
|------|------------|---------|
| Frontend | HTML, CSS y JavaScript sin framework | `frontend/src` |
| Backend (API) | Netlify Functions en TypeScript | `backend/src/functions` |
| Base de datos | Netlify Database (Postgres) con Drizzle ORM | `backend/src/db` + `netlify/database/migrations` |
| Archivos | Netlify Blobs (imágenes de artículos y fotos de perfil) | — |
| Correo | Nodemailer (códigos 2FA y recuperación de cuenta) | `backend/src/lib/mailer.ts` |

El navegador carga las páginas estáticas desde `frontend/src` y se comunica con la API mediante `fetch` a rutas `/api/*`.

## Frontend (`frontend/src`)
- `pages/` — una página HTML por pantalla (inicio, artículo, log in, sign in, noticias guardadas, perfil, panel de administración, etc.). La raíz `/` redirige a `/pages/index.html`.
- `js/` — lógica de cada página (`main.js`, `article-detail.js`, `profile.js`, `admin-panel.js`…) y utilidades compartidas (`dialogs.js`, `pins.js`, `fonts.js`).
- `css/` — estilos por página y estilos comunes (`logo.css`, `article-header.css`).
- `imagenes/` — logo, favicon e imágenes de la portada.

## Backend (`backend/src`)
### Endpoints
| Ruta | Función | Descripción |
|------|---------|-------------|
| `/api/register` | `register.ts` | Crear cuenta |
| `/api/login` | `login.ts` | Iniciar sesión y enviar código 2FA por correo |
| `/api/verify-2fa` | `verify-2fa.ts` | Validar el código 2FA y crear la sesión |
| `/api/articles`, `/api/articles/:id` | `articles.ts` | Listar, leer, crear y editar artículos |
| `/api/article-images` | `article-images.ts` | Subir y servir imágenes de artículos |
| `/api/saved` | `saved.ts` | Noticias guardadas del usuario |
| `/api/profile` | `profile.ts` | Datos y foto de perfil |
| `/api/account/*` | `account.ts` | Recuperación de contraseña/usuario y cambio de correo |
| `/api/admin/:resource` | `admin.ts` | Panel de administración (solo cuentas administradoras) |

### Código compartido (`lib/`)
- `session.ts` — tokens de sesión y comprobación de administrador.
- `mailer.ts` — envío de correos y plantillas.
- `shared.ts` — utilidades de lectura de JSON y formato de artículos.

## Base de datos
Tablas definidas en `backend/src/db/schema.ts`:
- `usuarios` — cuentas de usuario.
- `articulos` — noticias publicadas.
- `articulos_guardados` — relación usuario ↔ artículo guardado.
- `tokens_cuenta` — enlaces temporales de recuperación y verificación.

Las migraciones se generan con `npx drizzle-kit generate --name <cambio>` y se guardan en `netlify/database/migrations`; Netlify las aplica automáticamente en cada despliegue.

## Despliegue
`netlify.toml` indica que el sitio publicado es `frontend/src` y que las funciones están en `backend/src/functions`. Cada push a `main` despliega a producción.
