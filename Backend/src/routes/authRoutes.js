const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Configuración de la base de datos (puedes importarla desde tu archivo de configuración principal)
// Asegúrate de usar la misma configuración `dbConfig` que tienes en tu servidor.

// GET /api/articles - Obtener todos los artículos
router.get('/', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT * FROM Articulos ORDER BY fecha_publicacion DESC');
        res.status(200).json(result.recordset);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
});

// POST /api/articles - Crear un artículo nuevo
router.post('/', async (req, res) => {
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

// DELETE /api/articles/:id - Eliminar un artículo por ID
router.delete('/:id', async (req, res) => {
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

module.exports = router;