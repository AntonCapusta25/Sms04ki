import twilio from 'twilio';

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

  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' });
  }

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(to)) {
    return res.status(400).json({ 
      error: 'Invalid phone number format. Must be E.164 format (e.g., +1234567890)' 
    });
  }

  try {
    const client = twilio(accountSid, authToken);
    
    const twilioMessage = await client.messages.create({
      body: message,
      from: ALPHANUMERIC_SENDER_ID, // Will show as "YFEstheticClub" to recipients
      to: to,
    });

    return res.status(200).json({
      success: true,
      sid: twilioMessage.sid,
      status: twilioMessage.status,
    });
  } catch (error) {
    console.error('Twilio Error:', error);
    return res.status(400).json({
      error: error.message || 'Failed to send SMS',
    });
  }
}
