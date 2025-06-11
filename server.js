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

// Ruta de login con trazabilidad completa
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

    console.log('✅ Usuario encontrado. Hash guardado en DB:', user.password);
    console.log('🔐 Comparando contra contraseña ingresada:', password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🧪 Resultado de bcrypt.compare:', isMatch);

    if (isMatch) {
      console.log('🟢 Login exitoso:', user.studentCode);
      return res.json({ success: true, studentCode: user.studentCode });
    } else {
      console.warn('🔴 Contraseña incorrecta');
      console.warn('👉 Contraseña ingresada:', password);
      console.warn('👉 Hash en DB:', user.password);
      console.warn('🧾 Verifica que el hash fue generado exactamente desde esta contraseña');
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

  } catch (error) {
    console.error('🔥 Error en proceso de login:', error);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Ruta raíz para login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/login.html'));
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en http://localhost:${PORT}`));
