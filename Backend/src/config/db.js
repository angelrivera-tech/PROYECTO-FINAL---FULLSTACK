const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necesario para conexiones seguras a la nube en Supabase
    }
});

async function connectDB() {
    try {
        const client = await pool.connect();
        console.log('¡Conectado exitosamente a Supabase PostgreSQL!');
        client.release();
        return pool;
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
        throw err;
    }
}

module.exports = { pool, connectDB };