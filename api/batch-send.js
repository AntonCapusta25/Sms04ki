import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Alphanumeric Sender ID for Ukraine (no registration required)
const ALPHANUMERIC_SENDER_ID = 'YFEstheticClub'; // No spaces allowed

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  const { clientIds, message } = req.body;

  if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
    return res.status(400).json({ error: 'clientIds must be a non-empty array' });
  }

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const client = twilio(accountSid, authToken);

    // Get all clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, phone, status')
      .in('id', clientIds)
      .eq('status', 'active');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!clients || clients.length === 0) {
      return res.status(404).json({ error: 'No active clients found' });
    }

    // Send SMS to each client
    const results = await Promise.allSettled(
      clients.map(async (clientData) => {
        try {
          const twilioMessage = await client.messages.create({
            body: message,
            from: ALPHANUMERIC_SENDER_ID, // Will show as "YFEstheticClub" to recipients
            to: clientData.phone,
          });

          // Save to database
          await supabase.from('messages').insert({
            client_id: clientData.id,
            phone: clientData.phone,
            content: message,
            status: 'sent',
            twilio_sid: twilioMessage.sid,
            sent_at: new Date().toISOString(),
          });

          return {
            success: true,
            clientId: clientData.id,
            name: clientData.name,
            phone: clientData.phone,
            sid: twilioMessage.sid,
          };
        } catch (error) {
          // Save failed message to database
          await supabase.from('messages').insert({
            client_id: clientData.id,
            phone: clientData.phone,
            content: message,
            status: 'failed',
            error_message: error.message,
          });

          return {
            success: false,
            clientId: clientData.id,
            name: clientData.name,
            phone: clientData.phone,
            error: error.message,
          };
        }
      })
    );

    // Format results
    const sent = results
      .filter((r) => r.status === 'fulfilled' && r.value.success)
      .map((r) => r.value);
    const failed = results
      .filter((r) => r.status === 'fulfilled' && !r.value.success)
      .map((r) => r.value);

    return res.status(200).json({
      success: true,
      total: clients.length,
      sent: sent.length,
      failed: failed.length,
      results: { sent, failed },
    });
  } catch (error) {
    console.error('Batch send error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send batch SMS',
    });
  }
}
```

**Key points:**

1. ✅ **"YFEstheticClub"** (without spaces) will appear as the sender name on your clients' phones
2. ✅ **No registration required** for Ukraine - you can use it immediately
3. ✅ Meets requirements: 3-11 characters, includes letters, no special characters
4. ⚠️ **Recipients cannot reply** to alphanumeric sender IDs - if you need replies, include a contact number in your message

**Example of what your clients will see:**
```
From: YFEstheticClub
Message: Ваш запис на завтра о 15:00
