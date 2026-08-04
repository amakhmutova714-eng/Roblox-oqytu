const express    = require('express');
const path       = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI        = process.env.MONGODB_URI        || '';
const JWT_SECRET         = process.env.JWT_SECRET         || 'roblox-oqytu-secret-change-in-prod';
const ADMIN_PASSWORD     = process.env.ADMIN_PASSWORD     || 'admin123';
const CALLMEBOT_PHONE    = process.env.CALLMEBOT_PHONE    || '';
const CALLMEBOT_APIKEY   = process.env.CALLMEBOT_APIKEY   || '';
const EMAIL_USER         = process.env.EMAIL_USER         || '';
const EMAIL_PASS         = process.env.EMAIL_PASS         || '';

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

// ── Email sender ───────────────────────────────────────────────
async function sendWelcomeEmail(toEmail, name) {
  if (!EMAIL_USER || !EMAIL_PASS || !toEmail.includes('@')) return;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });
    await transporter.sendMail({
      from: `"Roblox Oqytu" <${EMAIL_USER}>`,
      to: toEmail,
      subject: 'Roblox Studio курсына қош келдің! 🎮',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:2rem;border-radius:16px;">
          <h2 style="color:#38bdf8;">Сәлем, ${name}! 👋</h2>
          <p>Roblox Studio қазақша курсына тіркелгенің үшін рақмет!</p>
          <p style="margin-top:1rem;">Сайтқа кіріп 1-сабақты тегін бастай аласың.</p>
          <p style="margin-top:1rem;">Толық нұсқа — <strong style="color:#38bdf8;">3 490 ₸</strong> (бір рет төлем, мәңгілік қол жетімділік).</p>
          <a href="https://roblox-oqytu.onrender.com"
             style="display:inline-block;margin-top:1.5rem;padding:0.75rem 1.5rem;background:#38bdf8;color:#0a1628;border-radius:10px;text-decoration:none;font-weight:bold;">
            Оқуды бастау →
          </a>
          <p style="margin-top:2rem;color:#7e9bb5;font-size:0.85rem;">Сұрақ болса WhatsApp: +7 705 250 6772</p>
        </div>`
    });
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

// ── WhatsApp notification (CallMeBot) ──────────────────────────
async function notifyWhatsApp(name, contact) {
  if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) return;
  try {
    const text = encodeURIComponent(`🎮 Жаңа оқушы тіркелді!\nАты: ${name}\nТелефон/Email: ${contact}`);
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&text=${text}&apikey=${CALLMEBOT_APIKEY}`);
  } catch (e) {
    console.error('WhatsApp notify error:', e.message);
  }
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

function makeStudentToken(student) {
  return jwt.sign(
    { studentId: student._id.toString(), name: student.name, isPremium: !!student.isPremium, type: 'student' },
    JWT_SECRET, { expiresIn: '30d' }
  );
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
      name: name.trim(), contact: contact.trim().toLowerCase(),
      passwordHash, isPremium: false, registeredAt: now, lastSeenAt: now
    });
    const student = { _id: result.insertedId, name: name.trim(), isPremium: false };
    const token = makeStudentToken(student);

    // Notifications (non-blocking)
    notifyWhatsApp(name.trim(), contact.trim());
    sendWelcomeEmail(contact.trim(), name.trim());

    res.json({ token, name: name.trim(), isPremium: false });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Бұл телефон/email тіркелген' });
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── STUDENT: login ─────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  const { contact, password } = req.body;
  if (!contact || !password) return res.status(400).json({ error: 'Барлық өрістерді толтыр' });
  try {
    const student = await db.collection('students').findOne({ contact: contact.trim().toLowerCase() });
    if (!student) return res.status(401).json({ error: 'Телефон/email табылмады' });
    const ok = await bcrypt.compare(password, student.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Пароль қате' });
    await db.collection('students').updateOne({ _id: student._id }, { $set: { lastSeenAt: new Date() } });
    const token = makeStudentToken(student);
    res.json({ token, name: student.name, isPremium: !!student.isPremium });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Қате орын алды' });
  }
});

// ── STUDENT: get my info ───────────────────────────────────────
app.get('/api/me', requireStudent, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const student = await db.collection('students').findOne(
      { _id: new ObjectId(req.student.studentId) },
      { projection: { passwordHash: 0 } }
    );
    if (!student) return res.status(404).json({ error: 'Табылмады' });
    res.json({ name: student.name, isPremium: !!student.isPremium });
  } catch (e) {
    res.status(500).json({ error: 'Қате' });
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
        studentId: req.student.studentId, studentName: req.student.name,
        lessonId, lessonTitle: lessonTitle || '', visitedAt: now
      }),
      db.collection('students').updateOne(
        { _id: new ObjectId(req.student.studentId) }, { $set: { lastSeenAt: now } }
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
      .sort({ registeredAt: -1 }).toArray();
    const ids = students.map(s => s._id.toString());
    const counts = await db.collection('activity_logs').aggregate([
      { $match: { studentId: { $in: ids } } },
      { $group: { _id: '$studentId', visits: { $sum: 1 }, uniqueLessons: { $addToSet: '$lessonId' } } }
    ]).toArray();
    const countMap = {};
    counts.forEach(c => { countMap[c._id] = { visits: c.visits, lessons: c.uniqueLessons.length }; });
    res.json(students.map(s => ({
      _id: s._id, name: s.name, contact: s.contact,
      isPremium: !!s.isPremium,
      registeredAt: s.registeredAt, lastSeenAt: s.lastSeenAt,
      totalVisits:   countMap[s._id.toString()]?.visits  || 0,
      lessonsOpened: countMap[s._id.toString()]?.lessons || 0
    })));
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Қате' });
  }
});

// ── ADMIN: toggle premium ──────────────────────────────────────
app.post('/api/admin/toggle-premium/:id', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const student = await db.collection('students').findOne({ _id: new ObjectId(req.params.id) });
    if (!student) return res.status(404).json({ error: 'Табылмады' });
    const newVal = !student.isPremium;
    await db.collection('students').updateOne({ _id: student._id }, { $set: { isPremium: newVal } });
    res.json({ isPremium: newVal });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Қате' });
  }
});

// ── ADMIN: activity log ────────────────────────────────────────
app.get('/api/admin/activity', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const logs = await db.collection('activity_logs')
      .find({}).sort({ visitedAt: -1 }).limit(500).toArray();
    res.json(logs);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Қате' });
  }
});

// ── ADMIN: stats ───────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Дерекқор қосылмаған' });
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [totalStudents, totalVisits, todayVisits] = await Promise.all([
      db.collection('students').countDocuments(),
      db.collection('activity_logs').countDocuments(),
      db.collection('activity_logs').countDocuments({ visitedAt: { $gte: today } })
    ]);
    res.json({ totalStudents, totalVisits, todayVisits });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Қате' });
  }
});

// ── Static fallback ────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('*',      (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Roblox Oqytu server running on port ${PORT}`));
}).catch(e => {
  console.error('DB connection failed:', e.message);
  app.listen(PORT, () => console.log(`Server running (no DB) on port ${PORT}`));
});
