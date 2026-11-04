// src/config/db.js
const sql = require('mssql');

const dbConfig = {
    server: 'DESKTOP-5HUIJKE\\SQLEXPRESS', // Your exact server name from SSMS
    database: 'WorldnewsDB',         // Your database name
    options: {
        trustedConnection: true,     // This tells it to use Windows Authentication!
        encrypt: true,
        trustServerCertificate: true // Required for local development
    }
};

async function connectDB() {
    try {
        let pool = await sql.connect(dbConfig);
        console.log('Connected to SQL Server using Windows Authentication!');
        return pool;
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
}

module.exports = { sql, connectDB };