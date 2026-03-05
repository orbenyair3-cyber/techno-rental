import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'tec_ele1@017.net.il';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Techno Electric <onboarding@resend.dev>';
const TOOL_MEDIA_BUCKET = process.env.TOOL_MEDIA_BUCKET || 'tool-media';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
let toolMediaBucketReady = false;

const ALLOWED_MEDIA_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
const MAX_MEDIA_FILE_BYTES = 20 * 1024 * 1024;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://orbenyair3-cyber.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      const isLocalhostDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ''));
      if (!origin || origin === 'null' || allowedOrigins.includes(origin) || isLocalhostDev) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json({ limit: '25mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const payload = match[2];
  try {
    const buffer = Buffer.from(payload, 'base64');
    return { mime, buffer };
  } catch {
    return null;
  }
}

async function ensureToolMediaBucket() {
  if (toolMediaBucketReady) return true;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Storage list buckets failed: ${listError.message}`);
  const exists = (buckets || []).some((b) => b.name === TOOL_MEDIA_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(TOOL_MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024
    });
    if (createError) throw new Error(`Storage create bucket failed: ${createError.message}`);
  }
  toolMediaBucketReady = true;
  return true;
}

function normalizeMediaUrls(tool) {
  const fromMediaUrls = Array.isArray(tool?.media_urls) ? tool.media_urls : [];
  const fromMedia = Array.isArray(tool?.media) ? tool.media : [];
  const fallback = tool?.image ? [tool.image] : [];
  return Array.from(new Set([...fromMediaUrls, ...fromMedia, ...fallback].map((v) => String(v || '').trim()).filter(Boolean)));
}

function mapDbToolToClient(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name || '',
    category: row.category || '',
    price: Number(row.price || 0),
    deposit: Number(row.deposit || 0),
    maxDays: Number(row.max_days || 0),
    image: row.image_url || row.image || '',
    desc: row.description || row.desc || '',
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : [],
    busyDates: Array.isArray(row.busydates) ? row.busydates : (Array.isArray(row.busyDates) ? row.busyDates : []),
    status: row.is_available === false ? 'maintenance' : 'available'
  };
}

function mapClientToolToDb(tool) {
  const mediaUrls = normalizeMediaUrls(tool);
  return {
    id: tool.id || undefined,
    name: tool.name || '',
    category: tool.category || '',
    price: Number(tool.price || 0),
    deposit: Number(tool.deposit || 0),
    max_days: Number(tool.max_days ?? tool.maxDays ?? 0),
    image_url: tool.image_url || tool.image || mediaUrls[0] || null,
    description: tool.description || tool.desc || '',
    media_urls: mediaUrls
  };
}

function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

function formatDateTimeHe(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'לא זמין';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem'
  }).format(date);
}

async function sendOrderEmails({ order, tool }) {
  if (!resend) {
    console.warn('Skipping email send: RESEND_API_KEY is not configured');
    return;
  }

  const siteUrl = 'https://orbenyair3-cyber.github.io/techno-rental/';
  const toolName = tool?.name || order.tool_id;
  const pricePerDay = Number(tool?.price || 0);
  const days = getDaysInclusive(order.start_date, order.end_date);
  const estimatedTotal = pricePerDay > 0 ? pricePerDay * days : null;
  const createdAtLabel = formatDateTimeHe(order.created_at || new Date().toISOString());

  const commonHtml = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
      <p><strong>מזהה הזמנה:</strong> ${order.id}</p>
      <p><strong>שם הכלי:</strong> ${toolName}</p>
      <p><strong>תאריך התחלה:</strong> ${order.start_date}</p>
      <p><strong>תאריך סיום:</strong> ${order.end_date}</p>
      <p><strong>תאריך ושעת ביצוע הזמנה:</strong> ${createdAtLabel}</p>
      <p><strong>מחיר ליום:</strong> ${pricePerDay > 0 ? `${pricePerDay} ₪` : 'לא זמין'}</p>
      <p><strong>סה"כ משוער:</strong> ${estimatedTotal !== null ? `${estimatedTotal} ₪ (${days} ימים)` : 'לא זמין'}</p>
      <p><strong>פרטי לקוח:</strong> ${order.customer_name} | ${order.customer_phone} | ${order.customer_email}</p>
      <p><a href="${siteUrl}">מעבר לאתר</a></p>
    </div>
  `;

  const jobs = [];

  if (order.customer_email) {
    jobs.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: order.customer_email,
        subject: 'אישור הזמנה – Techno Electric',
        html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ההזמנה שלך התקבלה בהצלחה</h2>${commonHtml}</div>`
      })
    );
  }

  if (MANAGER_EMAIL) {
    jobs.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: MANAGER_EMAIL,
        subject: 'הזמנה חדשה באתר – Techno Electric',
        html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>התקבלה הזמנה חדשה באתר</h2>${commonHtml}</div>`
      })
    );
  } else {
    console.warn('Skipping manager email: MANAGER_EMAIL is not configured');
  }

  const results = await Promise.allSettled(jobs);
  results.forEach((r) => {
    if (r.status === 'rejected') {
      console.error('Email sending failed:', r.reason);
    }
  });
}

async function sendContactEmail({ name, email, phone, message }) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!MANAGER_EMAIL) {
    throw new Error('MANAGER_EMAIL is not configured');
  }

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
      <h2>הודעה חדשה מטופס יצירת קשר</h2>
      <p><strong>שם:</strong> ${name || '-'}</p>
      <p><strong>אימייל:</strong> ${email || '-'}</p>
      <p><strong>טלפון:</strong> ${phone || '-'}</p>
      <p><strong>הודעה:</strong><br>${String(message || '').replace(/\n/g, '<br>')}</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: MANAGER_EMAIL,
    subject: 'New contact form message',
    html
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/realtime-config', (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: 'Realtime config is missing on server' });
    return;
  }
  res.json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
});

app.get('/api/tools', async (req, res) => {
  const { data, error } = await supabase.from('tools').select('*').order('id', { ascending: true });
  if (error) {
    console.error('[GET /api/tools] error:', error.message, error.details, error.hint, error.code);
    res.status(500).json({ error: 'Failed to fetch tools', details: error.message });
    return;
  }
  res.json((data || []).map(mapDbToolToClient));
});

app.get('/api/orders', async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    return;
  }
  res.json(data);
});

app.get('/api/tools/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const channelName = `tools-stream-${randomUUID()}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tools' }, (payload) => {
      res.write(`data: ${JSON.stringify({ type: 'tools_changed', event: payload.eventType })}\n\n`);
    });

  await channel.subscribe();
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', async () => {
    clearInterval(ping);
    try { await supabase.removeChannel(channel); } catch {}
    res.end();
  });
});

app.post('/api/tools', async (req, res) => {
  const payload = mapClientToolToDb(req.body || {});
  const insertPayload = payload.id ? payload : { ...payload, id: undefined };
  const { data, error } = await supabase.from('tools').insert(insertPayload).select('*').single();
  if (error) {
    console.error('[POST /api/tools] error:', error.message, error.details, error.hint, error.code);
    res.status(500).json({ error: 'Failed to create tool', details: error.message });
    return;
  }
  res.status(201).json(mapDbToolToClient(data));
});

app.put('/api/tools/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  const payload = mapClientToolToDb({ ...(req.body || {}), id });
  const { data, error } = await supabase.from('tools').update(payload).eq('id', id).select('*').single();
  if (error) {
    console.error('[PUT /api/tools/:id] error:', error.message, error.details, error.hint, error.code);
    res.status(500).json({ error: 'Failed to update tool', details: error.message });
    return;
  }
  res.json(mapDbToolToClient(data));
});

app.delete('/api/tools/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  const { error } = await supabase.from('tools').delete().eq('id', id);
  if (error) {
    console.error('[DELETE /api/tools/:id] error:', error.message, error.details, error.hint, error.code);
    res.status(500).json({ error: 'Failed to delete tool', details: error.message });
    return;
  }
  res.json({ ok: true });
});

app.put('/api/tools', async (req, res) => {
  const incomingTools = req.body;

  if (!Array.isArray(incomingTools)) {
    res.status(400).json({ error: 'Body must be an array of tools' });
    return;
  }

  if (incomingTools.some((tool) => !tool || !tool.id)) {
    res.status(400).json({ error: 'Each tool must include id' });
    return;
  }

  const tools = incomingTools.map(mapClientToolToDb);

  const { data, error } = await supabase
    .from('tools')
    .upsert(tools, { onConflict: 'id' })
    .select('*');

  if (error) {
    console.error('[PUT /api/tools] error:', error.message, error.details, error.hint, error.code);
    res.status(500).json({ error: 'Failed to update tools', details: error.message });
    return;
  }

  res.json((data || []).map(mapDbToolToClient));
});

app.post('/api/media/upload', async (req, res) => {
  try {
    await ensureToolMediaBucket();
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) {
      res.status(400).json({ error: 'files array is required' });
      return;
    }

    const uploaded = [];
    for (const file of files) {
      const parsed = dataUrlToBuffer(file?.dataUrl || '');
      const mime = String(file?.type || parsed?.mime || '').toLowerCase();
      if (!parsed || !ALLOWED_MEDIA_MIME.has(mime)) {
        res.status(400).json({ error: `Unsupported file type: ${mime || 'unknown'}` });
        return;
      }
      if (parsed.buffer.length > MAX_MEDIA_FILE_BYTES) {
        res.status(400).json({ error: 'File too large (max 20MB)' });
        return;
      }
      const ext = mime.split('/')[1] || 'bin';
      const safeName = String(file?.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `tools/${new Date().toISOString().slice(0, 10)}/${randomUUID()}_${safeName}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(TOOL_MEDIA_BUCKET)
        .upload(path, parsed.buffer, { contentType: mime, upsert: false });
      if (uploadError) {
        console.error('[POST /api/media/upload] upload error:', uploadError.message);
        res.status(500).json({ error: 'Failed uploading file', details: uploadError.message });
        return;
      }
      const { data: pub } = supabase.storage.from(TOOL_MEDIA_BUCKET).getPublicUrl(path);
      uploaded.push(pub?.publicUrl);
    }

    res.json({ urls: uploaded.filter(Boolean) });
  } catch (err) {
    console.error('[POST /api/media/upload] error:', err?.message || err);
    res.status(500).json({ error: 'Media upload failed', details: err?.message || 'Unknown error' });
  }
});

app.post('/api/orders', async (req, res) => {
  console.log('[POST /api/orders] request body:', req.body);
  const body = req.body || {};

  if (!body.tool_id || !body.start_date || !body.end_date || !body.customer_name || !body.customer_phone) {
    res.status(400).json({ error: 'Missing required fields: tool_id, start_date, end_date, customer_name, customer_phone' });
    return;
  }

  try {
    const insertPayload = {
      tool_id: body.tool_id,
      start_date: body.start_date,
      end_date: body.end_date,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone
    };

    const { data: created, error: createError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select('*')
      .single();

    if (createError) {
      console.error('[POST /api/orders] Supabase insert error:', createError.message, createError.details);
      res.status(500).json({
        error: 'Failed creating order',
        message: createError.message,
        details: createError.details
      });
      return;
    }

    res.status(200).json(created);

    // fire-and-forget emails
    sendOrderEmails({ order: created, tool: null }).catch((err) => {
      console.error('Failed sending order emails:', err);
    });
  } catch (err) {
    console.error('[POST /api/orders] Unexpected error:', err?.message || err);
    res.status(500).json({ error: 'Unexpected server error', details: err?.message || 'Unknown error' });
  }
});

app.post('/api/contact', async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!message) {
    console.error('[POST /api/contact] Validation error: message is required');
    res.status(400).json({ ok: false, error: 'message is required' });
    return;
  }

  const { error: insertError } = await supabase
    .from('contact_messages')
    .insert({
      name: name || null,
      email: email || null,
      phone: phone || null,
      message
    });

  if (insertError) {
    console.error('[POST /api/contact] Supabase insert error:', insertError.message, insertError.details);
    res.status(500).json({ ok: false, error: 'Failed to save contact message' });
    return;
  }

  try {
    await sendContactEmail({ name, email, phone, message });
  } catch (emailError) {
    console.error('[POST /api/contact] Email send error:', emailError?.message || emailError);
    res.status(500).json({ ok: false, error: 'Failed to send contact email' });
    return;
  }

  res.json({ ok: true });
});

app.put('/api/orders/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};

  if (!id) {
    res.status(400).json({ error: 'Order id is required' });
    return;
  }

  const allowed = ['approved', 'cancelled'];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    res.status(500).json({ error: 'Failed fetching order', details: existingError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed updating order status', details: error.message });
    return;
  }

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Techno Rental API listening on port ${PORT}`);
});
