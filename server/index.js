import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  const { tool_id, start_date, end_date, customer_name, customer_phone } = req.body || {};

  if (!tool_id) {
    res.status(400).json({ error: 'tool_id is required' });
    return;
  }
  if (!isValidDateString(start_date) || !isValidDateString(end_date)) {
    res.status(400).json({ error: 'start_date and end_date must be valid YYYY-MM-DD dates' });
    return;
  }
  if (start_date > end_date) {
    res.status(400).json({ error: 'start_date cannot be after end_date' });
    return;
  }
  if (!customer_name || !String(customer_name).trim()) {
    res.status(400).json({ error: 'customer_name is required' });
    return;
  }
  if (!customer_phone || !String(customer_phone).trim()) {
    res.status(400).json({ error: 'customer_phone is required' });
    return;
  }

  const { data: toolRow, error: toolError } = await supabase
    .from('tools')
    .select('id')
    .eq('id', tool_id)
    .maybeSingle();

  if (toolError) {
    res.status(500).json({ error: 'Failed validating tool', details: toolError.message });
    return;
  }
  if (!toolRow) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  const { data: overlaps, error: overlapError } = await supabase
    .from('orders')
    .select('id,start_date,end_date')
    .eq('tool_id', tool_id)
    .lte('start_date', end_date)
    .gte('end_date', start_date);

  if (overlapError) {
    res.status(500).json({ error: 'Failed checking overlap', details: overlapError.message });
    return;
  }

  if (overlaps && overlaps.length > 0) {
    res.status(409).json({
      error: 'Tool already booked for the selected date range',
      conflicts: overlaps
    });
    return;
  }

  const payload = {
    tool_id,
    start_date,
    end_date,
    customer_name: String(customer_name).trim(),
    customer_phone: String(customer_phone).trim()
  };

  const { data: created, error: createError } = await supabase
    .from('orders')
    .insert(payload)
    .select('*')
    .single();

  if (createError) {
    res.status(500).json({ error: 'Failed creating order', details: createError.message });
    return;
  }

  res.status(201).json(created);
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
