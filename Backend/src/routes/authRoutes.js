const express = require('express');
const router = express.Router();


// GET /api/articles - Obtener todos los artículos
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Articulos ORDER BY fecha_publicacion DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Error al obtener los artículos' });
    }
});

// POST /api/articles - Crear un artículo nuevo
router.post('/', async (req, res) => {
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

// DELETE /api/articles/:id - Eliminar un artículo por ID
router.delete('/:id', async (req, res) => {
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

module.exports = router;