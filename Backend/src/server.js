require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // 👈 Fuerza a Node.js a priorizar IPv4 en la resolución DNS

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración de la conexión a Supabase (PostgreSQL) usando objeto explícito
const pool = new Pool({
    user: 'postgres',
    password: 'Estrell@0628**',
    host: 'db.xofnwzwlhbczheoyhxip.supabase.co',
    database: 'postgres',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
    family: 4 // 👈 Fuerza estrictamente a usar IPv4
});

// Probar conexión inicial al arrancar
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar a Supabase:', err.stack);
    } else {
        console.log('✅ Conectado exitosamente a Supabase (PostgreSQL)');
        release();
    }
});

// Configuración del servicio de correo con Nodemailer usando variables de entorno
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Se lee desde Render
        pass: process.env.EMAIL_PASS  // Se lee desde Render
    }
});

// Ruta para Registrar Usuario
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO Usuarios (username, password_hash, email) VALUES ($1, $2, $3)',
            [username, hashedPassword, email]
        );

        res.status(201).json({ message: 'Usuario registrado con éxito' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message || 'Error al registrar el usuario' });
    }
});

// Ruta 1 para Iniciar Sesión (Paso 1: Valida credenciales y envía el correo con el código 2FA)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM Usuarios WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        // Generar código aleatorio de 6 dígitos para el 2FA
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60000); // Expira en 5 minutos

        // Guardar el código temporal en la base de datos
        await pool.query(
            'UPDATE Usuarios SET verification_code = $1, code_expires = $2 WHERE id = $3',
            [code, expires, user.id]
        );

        // Configuración del correo electrónico que se enviará al usuario
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Worldnews - Tu código de verificación 2FA',
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
            `
        };

        // Enviar el correo usando Nodemailer
        await transporter.sendMail(mailOptions);
        console.log(`📧 [2FA] Correo enviado exitosamente a: ${user.email}`);

        res.status(200).json({ 
            requires2FA: true, 
            userId: user.id, 
            message: 'Código de verificación enviado a tu correo electrónico.' 
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al enviar el correo de verificación' });
    }
});

// Ruta 2 para Verificar el Código 2FA (Paso 2: Valida el código de 6 dígitos)
app.post('/api/verify-2fa', async (req, res) => {
    const { userId, code } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM Usuarios WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const user = result.rows[0];
        const now = new Date();

        // Validar que el código coincida y no haya expirado
        if (!user.verification_code || user.verification_code !== code || new Date(user.code_expires) < now) {
            return res.status(400).json({ error: 'Código inválido o expirado' });
        }

        // Limpiar el código usado de la base de datos por seguridad
        await pool.query(
            'UPDATE Usuarios SET verification_code = NULL, code_expires = NULL WHERE id = $1',
            [userId]
        );

        res.status(200).json({ success: true, message: '¡Login exitoso!', username: user.username });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al verificar el código' });
    }
});

// Ruta para Crear un Artículo (POST)
app.post('/api/articles', async (req, res) => {
    const { title, category, image_url, content, usuario_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO Articulos (title, category, image_url, content, usuario_id) VALUES ($1, $2, $3, $4, $5)',
            [title, category, image_url, content, usuario_id || null]
        );

        res.status(201).json({ message: 'Artículo creado con éxito' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al crear el artículo' });
    }
});

// Ruta para Obtener Todos los Artículos (GET)
app.get('/api/articles', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Articulos ORDER BY fecha_publicacion DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
});

// Ruta para Obtener un Artículo Individual por su ID (GET :id)
app.get('/api/articles/:id', async (req, res) => {
    const articleId = req.params.id;
    try {
        const result = await pool.query(
            'SELECT * FROM Articulos WHERE id = $1',
            [articleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener el artículo' });
    }
});

// Ruta para Eliminar un Artículo por ID (DELETE)
app.delete('/api/articles/:id', async (req, res) => {
    const articleId = req.params.id;
    try {
        await pool.query(
            'DELETE FROM Articulos WHERE id = $1',
            [articleId]
        );

        res.status(200).json({ message: 'Artículo eliminado con éxito' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al eliminar el artículo' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});