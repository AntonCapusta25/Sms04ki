import twilio from 'twilio';

const ALPHANUMERIC_SENDER_ID = 'YFEsthetic'; // Without spaces for testing

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
      from: ALPHANUMERIC_SENDER_ID,
      to: to,
    });

    return res.status(200).json({
      success: true,
      sid: twilioMessage.sid,
      status: twilioMessage.status,
      sentFrom: ALPHANUMERIC_SENDER_ID,
    });
  } catch (error) {
    console.error('Twilio Error:', error);
    return res.status(400).json({
      error: error.message || 'Failed to send SMS',
      code: error.code,
      moreInfo: error.moreInfo,
    });
  }
}
