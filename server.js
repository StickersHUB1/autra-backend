const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: 'https://stickershub1.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

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

// Protección para métodos no permitidos en /api/*
app.all('/api/*', (req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
  next();
});

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
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

  } catch (error) {
    console.error('🔥 Error en proceso de login:', error);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});
