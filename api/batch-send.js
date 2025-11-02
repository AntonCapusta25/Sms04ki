import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Ukrainian phone number for display purposes only
const DISPLAY_PHONE_NUMBER = '+380501234567'; // Replace with your actual Ukrainian number

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
            from: twilioPhoneNumber,
            to: clientData.phone,
          });

          // Save to database with display phone number
          await supabase.from('messages').insert({
            client_id: clientData.id,
            phone: clientData.phone,
            content: message,
            status: 'sent',
            twilio_sid: twilioMessage.sid,
            sent_at: new Date().toISOString(),
            display_from: DISPLAY_PHONE_NUMBER, // Store the display number
            actual_from: twilioPhoneNumber, // Store actual Twilio number for reference
          });

          return {
            success: true,
            clientId: clientData.id,
            name: clientData.name,
            phone: clientData.phone,
            sid: twilioMessage.sid,
            displayFrom: DISPLAY_PHONE_NUMBER, // Return display number to client
          };
        } catch (error) {
          // Save failed message to database
          await supabase.from('messages').insert({
            client_id: clientData.id,
            phone: clientData.phone,
            content: message,
            status: 'failed',
            error_message: error.message,
            display_from: DISPLAY_PHONE_NUMBER,
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
      displayFrom: DISPLAY_PHONE_NUMBER, // Include display number in response
      results: { sent, failed },
    });
  } catch (error) {
    console.error('Batch send error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send batch SMS',
    });
  }
}
