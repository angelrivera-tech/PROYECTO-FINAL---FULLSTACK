require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración directa de la conexión a SQL Server
const dbConfig = {
    server: 'DESKTOP-5HUIJKE',
    database: 'WorldnewsDB',
    user: 'adminUser',          
    password: 'Estrella0628**', 
    options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: 'SQLEXPRESS',
        trustedConnection: false 
    }
};

// Configuración del servicio de correo con Nodemailer (con datos directos)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gaby.resto0628@gmail.com',         // <--- Reemplaza con tu correo real de Gmail
        pass: 'bhiwfvwxetloczzz'      // <--- Reemplaza con tu contraseña de aplicación de 16 dígitos
    }
});

// Ruta para Registrar Usuario
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.request()
            .input('username', sql.VarChar, username)
            .input('password_hash', sql.VarChar, hashedPassword)
            .input('email', sql.VarChar, email)
            .query('INSERT INTO Usuarios (username, password_hash, email) VALUES (@username, @password_hash, @email)');

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
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Usuarios WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = result.recordset[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        // Generar código aleatorio de 6 dígitos para el 2FA
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60000); // Expira en 5 minutos

        // Guardar el código temporal en la base de datos
        await pool.request()
            .input('id', sql.Int, user.id)
            .input('code', sql.VarChar, code)
            .input('expires', sql.DateTime, expires)
            .query('UPDATE Usuarios SET verification_code = @code, code_expires = @expires WHERE id = @id');

        // Configuración del correo electrónico que se enviará al usuario
        const mailOptions = {
            from: 'tu_correo_real@gmail.com', // <--- Asegúrate de poner aquí el mismo correo o remitente
            to: user.email, // Correo dinámico obtenido de la base de datos del usuario
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

        // Le avisamos al frontend que el login básico pasó y el código fue enviado por correo
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
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT * FROM Usuarios WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const user = result.recordset[0];
        const now = new Date();

        // Validar que el código coincida y no haya expirado
        if (!user.verification_code || user.verification_code !== code || new Date(user.code_expires) < now) {
            return res.status(400).json({ error: 'Código inválido o expirado' });
        }

        // Limpiar el código usado de la base de datos por seguridad
        await pool.request()
            .input('id', sql.Int, userId)
            .query('UPDATE Usuarios SET verification_code = NULL, code_expires = NULL WHERE id = @id');

        // Acceso completamente concedido
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
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('title', sql.VarChar, title)
            .input('category', sql.VarChar, category)
            .input('image_url', sql.VarChar, image_url)
            .input('content', sql.Text, content)
            .input('usuario_id', sql.Int, usuario_id || null)
            .query('INSERT INTO Articulos (title, category, image_url, content, usuario_id) VALUES (@title, @category, @image_url, @content, @usuario_id)');

        res.status(201).json({ message: 'Artículo creado con éxito' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al crear el artículo' });
    }
});

// Ruta para Obtener Todos los Artículos (GET)
app.get('/api/articles', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT * FROM Articulos ORDER BY fecha_publicacion DESC');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
});

// Ruta para Obtener un Artículo Individual por su ID (GET :id)
app.get('/api/articles/:id', async (req, res) => {
    const articleId = req.params.id;
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('id', sql.Int, articleId)
            .query('SELECT * FROM Articulos WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }

        res.status(200).json(result.recordset[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener el artículo' });
    }
});

// Ruta para Eliminar un Artículo por ID (DELETE)
app.delete('/api/articles/:id', async (req, res) => {
    const articleId = req.params.id;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, articleId)
            .query('DELETE FROM Articulos WHERE id = @id');

        res.status(200).json({ message: 'Artículo eliminado con éxito' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al eliminar el artículo' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});