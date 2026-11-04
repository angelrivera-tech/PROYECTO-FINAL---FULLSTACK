const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController'); // Ajusta la ruta según dónde tengas tu controlador

// POST /api/register - Registrar un nuevo usuario
router.post('/register', registerUser);

// POST /api/login - Iniciar sesión
router.post('/login', loginUser);

module.exports = router;