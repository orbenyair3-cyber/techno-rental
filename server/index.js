import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'tec_ele1@017.net.il';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Techno Electric <onboarding@resend.dev>';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const allowedOrigins = ['https://orbenyair3-cyber.github.io'];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS blocked for this origin'));
    },
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json());

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

app.get('/api/tools', async (req, res) => {
  const { data, error } = await supabase.from('tools').select('*').order('id', { ascending: true });
  if (error) {
    res.status(500).json({ error: 'Failed to fetch tools', details: error.message });
    return;
  }
  res.json(data);
});

app.get('/api/orders', async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    return;
  }
  res.json(data);
});

app.put('/api/tools', async (req, res) => {
  const tools = req.body;

  if (!Array.isArray(tools)) {
    res.status(400).json({ error: 'Body must be an array of tools' });
    return;
  }

  if (tools.some((tool) => !tool || !tool.id)) {
    res.status(400).json({ error: 'Each tool must include id' });
    return;
  }

  const { data, error } = await supabase
    .from('tools')
    .upsert(tools, { onConflict: 'id' })
    .select('*');

  if (error) {
    res.status(500).json({ error: 'Failed to update tools', details: error.message });
    return;
  }

  res.json(data);
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
    res.status(400).json({ error: 'message is required' });
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
    res.status(500).json({ error: 'Failed to save contact message', details: insertError.message });
    return;
  }

  try {
    await sendContactEmail({ name, email, phone, message });
  } catch (emailError) {
    res.status(500).json({ error: 'Failed to send contact email', details: emailError.message });
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
