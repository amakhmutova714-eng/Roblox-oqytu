const express = require('express');
const path    = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI    = process.env.MONGODB_URI    || '';
const JWT_SECRET     = process.env.JWT_SECRET     || 'roblox-oqytu-secret-change-in-prod';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── DB connection ──────────────────────────────────────────────
let db;
async function connectDB() {
  if (!MONGODB_URI) { console.warn('MONGODB_URI not set — skipping DB'); return; }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('roblox_oqytu');
  await db.collection('students').createIndex({ contact: 1 }, { unique: true });
  console.log('MongoDB connected');
}

// ── Auth middleware ────────────────────────────────────────────
function requireStudent(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Кіру керек' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'student') return res.status(403).json({ error: 'Рұқсат жоқ' });
    req.student = payload;
    next();
  } catch { res.status(401).json({ error: 'Токен жарамсыз' }); }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Кіру керек' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'admin') return res.status(403).json({ error: 'Рұқсат жоқ' });
    next();
  } catch { res.status(401).json({ error: 'Токен жарамсыз' }); }
}

// ── STUDENT: register ──────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  const { name, contact, password } = req.body;
  if (!name || !contact || !password)
    return res.status(400).json({ error: 'Барлық өрістерді толтыр' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Пароль кемінде 4 таңба' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const result = await db.collection('students').insertOne({
      name: name.trim(),
      contact: contact.trim().toLowerCase(),
      passwordHash,
      registeredAt: now,
      lastSeenAt: now
    });
    const token = jwt.sign(
      { studentId: result.insertedId.toString(), name: name.trim(), type: 'student' },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, name: name.trim() });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: 'Бұл телефон/email тіркелген' });
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── STUDENT: login ─────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  const { contact, password } = req.body;
  if (!contact || !password)
    return res.status(400).json({ error: 'Барлық өрістерді толтыр' });
  try {
    const student = await db.collection('students').findOne({
      contact: contact.trim().toLowerCase()
    });
    if (!student)
      return res.status(401).json({ error: 'Телефон/email табылмады' });
    const ok = await bcrypt.compare(password, student.passwordHash);
    if (!ok)
      return res.status(401).json({ error: 'Пароль қате' });
    await db.collection('students').updateOne(
      { _id: student._id },
      { $set: { lastSeenAt: new Date() } }
    );
    const token = jwt.sign(
      { studentId: student._id.toString(), name: student.name, type: 'student' },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, name: student.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── STUDENT: track lesson visit ────────────────────────────────
app.post('/api/track', requireStudent, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  const { lessonId, lessonTitle } = req.body;
  if (!lessonId) return res.status(400).json({ error: 'lessonId жоқ' });
  try {
    const now = new Date();
    await Promise.all([
      db.collection('activity_logs').insertOne({
        studentId:    req.student.studentId,
        studentName:  req.student.name,
        lessonId,
        lessonTitle:  lessonTitle || '',
        visitedAt:    now
      }),
      db.collection('students').updateOne(
        { _id: new ObjectId(req.student.studentId) },
        { $set: { lastSeenAt: now } }
      )
    ]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── ADMIN: login ───────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Пароль қате' });
  const token = jwt.sign({ type: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ── ADMIN: list students ───────────────────────────────────────
app.get('/api/admin/students', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const students = await db.collection('students')
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ registeredAt: -1 })
      .toArray();

    const ids = students.map(s => s._id.toString());
    const counts = await db.collection('activity_logs').aggregate([
      { $match: { studentId: { $in: ids } } },
      { $group: { _id: '$studentId', visits: { $sum: 1 }, uniqueLessons: { $addToSet: '$lessonId' } } }
    ]).toArray();

    const countMap = {};
    counts.forEach(c => { countMap[c._id] = { visits: c.visits, lessons: c.uniqueLessons.length }; });

    res.json(students.map(s => ({
      _id:          s._id,
      name:         s.name,
      contact:      s.contact,
      registeredAt: s.registeredAt,
      lastSeenAt:   s.lastSeenAt,
      totalVisits:  countMap[s._id.toString()]?.visits   || 0,
      lessonsOpened:countMap[s._id.toString()]?.lessons  || 0
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── ADMIN: activity log ────────────────────────────────────────
app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const logs = await db.collection('activity_logs')
      .find({})
      .sort({ visitedAt: -1 })
      .limit(500)
      .toArray();
    res.json(logs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── ADMIN: stats summary ───────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalStudents, totalVisits, todayVisits] = await Promise.all([
      db.collection('students').countDocuments(),
      db.collection('activity_logs').countDocuments(),
      db.collection('activity_logs').countDocuments({ visitedAt: { $gte: today } })
    ]);
    res.json({ totalStudents, totalVisits, todayVisits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── Static fallback ────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Roblox Oqytu server running on port ${PORT}`));
}).catch(e => {
  console.error('DB connection failed:', e.message);
  app.listen(PORT, () => console.log(`Server running (no DB) on port ${PORT}`));
});
