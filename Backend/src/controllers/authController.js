const bcrypt = require('bcrypt');

// Register User Controller
const registerUser = async (req, res) => {
    const { username, password, email } = req.body;
    try {
        // Encriptar la contraseña de forma segura
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insertar en la tabla Usuarios usando PostgreSQL ($1, $2, $3)
        await pool.query(
            'INSERT INTO Usuarios (username, password_hash, email) VALUES ($1, $2, $3)',
            [username, hashedPassword, email]
        );

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
        // Buscar el usuario usando PostgreSQL ($1)
        const result = await pool.query(
            'SELECT * FROM Usuarios WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = result.rows[0];

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