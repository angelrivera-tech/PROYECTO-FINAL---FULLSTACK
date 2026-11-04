const sql = require('mssql');
const bcrypt = require('bcrypt');

// Importa o define tu configuración de base de datos aquí (o exportala desde server.js)
const dbConfig = {
    server: 'DESKTOP-5HUIJKE\\SQLEXPRESS',
    database: 'WorldnewsDB',
    user: 'adminUser',
    password: 'Estrella0628**',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: false
    }
};

// Register User Controller
const registerUser = async (req, res) => {
    const { username, password, email } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        
        // Encriptar la contraseña de forma segura
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insertar en la tabla Usuarios
        await pool.request()
            .input('username', sql.VarChar, username)
            .input('password_hash', sql.VarChar, hashedPassword)
            .input('email', sql.VarChar, email)
            .query('INSERT INTO Usuarios (username, password_hash, email) VALUES (@username, @password_hash, @email)');

        res.status(201).json({ message: 'Usuario registrado con éxito' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Error al registrar el usuario' });
    }
};

// Login User Controller
const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        
        let result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Usuarios WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = result.recordset.log || result.recordset[0];

        // Comparar la contraseña ingresada con el hash de la base de datos
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        res.status(200).json({ message: 'Login exitoso', username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

module.exports = {
    registerUser,
    loginUser
};