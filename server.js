const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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

// ===============================
// 🔐 LOGIN
// ===============================
app.post('/api/login', async (req, res) => {
  const { studentCode, password } = req.body;
  console.log('--- LOGIN ATTEMPT ---');
  console.log('📥 Recibido ->', studentCode);

  if (!studentCode || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos' });
  }

  try {
    const db = client.db('autra');
    const normalizedCode = studentCode.toUpperCase();

    const user = await db
      .collection('users')
      .findOne({ studentCode: normalizedCode });

    if (!user) {
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: 'Credenciales inválidas' });
    }

    return res.json({ success: true, studentCode: user.studentCode });
  } catch (error) {
    console.error('🔥 Error en login:', error);
    return res.status(500).json({ success: false, message: 'Error servidor' });
  }
});

// ===============================
// 💾 GUARDAR PÁGINA
// ===============================
app.post('/api/save-page', async (req, res) => {
  const { studentCode, page, formFields, annotation } = req.body;

  if (!studentCode || !page) {
    return res.status(400).json({ success: false, message: 'Datos incompletos' });
  }

  try {
    const db = client.db('autra');
    await db.collection('pageData').updateOne(
      { studentCode, page },
      {
        $set: {
          formFields,
          annotation,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error guardando página:', err);
    res.status(500).json({ success: false, message: 'Error al guardar' });
  }
});

// ===============================
// 📤 CARGAR PÁGINA
// ===============================
app.get('/api/load-page', async (req, res) => {
  const { studentCode, page } = req.query;

  if (!studentCode || !page) {
    return res.status(400).json({ success: false, message: 'Parámetros faltantes' });
  }

  try {
    const db = client.db('autra');
    const data = await db
      .collection('pageData')
      .findOne({ studentCode, page: parseInt(page) });

    if (!data) {
      return res.json({ success: true, formFields: {}, annotation: null });
    }

    res.json({
      success: true,
      formFields: data.formFields || {},
      annotation: data.annotation || null
    });
  } catch (err) {
    console.error('❌ Error cargando página:', err);
    res.status(500).json({ success: false, message: 'Error al cargar' });
  }
});

// ===============================
// 🎥 ZOOM SDK – SIGNATURE
// ===============================
app.get('/api/zoom-signature', (req, res) => {
  const { meetingNumber, role } = req.query;

  if (!meetingNumber) {
    return res.status(400).json({ error: 'meetingNumber requerido' });
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const payload = {
    sdkKey: process.env.ZOOM_SDK_KEY,
    mn: meetingNumber,
    role: Number(role || 0),
    iat,
    exp,
    appKey: process.env.ZOOM_SDK_KEY,
    tokenExp: exp
  };

  const header = { alg: 'HS256', typ: 'JWT' };

  const base64 = obj =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const data = `${base64(header)}.${base64(payload)}`;

  const signature = crypto
    .createHmac('sha256', process.env.ZOOM_SDK_SECRET)
    .update(data)
    .digest('base64url');

  res.json({ signature: `${data}.${signature}` });
});

// ===============================
// 🌐 FRONTEND
// ===============================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/login.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===============================
// 🚀 START
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`)
);
