const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Conexión a MongoDB
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connectDB() {
  try {
    console.log('🧭 Conectando a URI:', uri);
    await client.connect();
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}
connectDB();

// Ruta de login
app.post('/api/login', async (req, res) => {
  const { studentCode, password } = req.body;
  console.log('--- LOGIN ATTEMPT ---');
  console.log('📥 Recibido desde frontend -> studentCode:', studentCode, '| password:', password);

  if (!studentCode || !password) {
    console.warn('⚠️ Faltan datos en la petición');
    return res.status(400).json({ success: false, message: 'Faltan datos' });
  }

  try {
    const db = client.db('autra');
    const normalizedCode = studentCode.toUpperCase();
    console.log('🔍 Buscando en MongoDB -> studentCode:', normalizedCode);

    const user = await db.collection('users').findOne({ studentCode: normalizedCode });
    if (!user) {
      console.warn('⛔ Usuario no encontrado:', normalizedCode);
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🧪 Resultado de bcrypt.compare:', isMatch);

    if (isMatch) {
      console.log('🟢 Login exitoso:', user.studentCode);
      return res.json({ success: true, studentCode: user.studentCode });
    } else {
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

  } catch (error) {
    console.error('🔥 Error en proceso de login:', error);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Ruta para guardar anotaciones y campos
app.post('/api/save-page', async (req, res) => {
  const { studentCode, page, formFields, annotation } = req.body;
  if (!studentCode || !page) {
    return res.status(400).json({ success: false, message: 'Datos incompletos' });
  }

  try {
    const db = client.db('autra');
    const collection = db.collection('pageData');

    await collection.updateOne(
      { studentCode, page },
      { $set: { formFields, annotation, updatedAt: new Date() } },
      { upsert: true }
    );

    console.log(`💾 Guardado página ${page} para ${studentCode}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error guardando página:', err);
    res.status(500).json({ success: false, message: 'Error al guardar' });
  }
});

// Ruta para cargar anotaciones y campos
app.get('/api/load-page', async (req, res) => {
  const { studentCode, page } = req.query;
  if (!studentCode || !page) {
    return res.status(400).json({ success: false, message: 'Parámetros faltantes' });
  }

  try {
    const db = client.db('autra');
    const data = await db.collection('pageData').findOne({ studentCode, page: parseInt(page) });

    if (!data) return res.json({ success: true, formFields: {}, annotation: null });

    console.log(`📤 Cargando página ${page} para ${studentCode}`);
    res.json({ success: true, formFields: data.formFields || {}, annotation: data.annotation || null });
  } catch (err) {
    console.error('❌ Error cargando página:', err);
    res.status(500).json({ success: false, message: 'Error al cargar' });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/login.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));
