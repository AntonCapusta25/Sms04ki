import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;
    
    // Log webhook data for debugging
    console.log('EasyWeek Webhook:', JSON.stringify(webhookData));

    // Extract client info from booking webhook
    // EasyWeek sends: booking.client.name and booking.client.phone
    const clientName = webhookData.booking?.client?.name || 
                       webhookData.client?.name || 
                       webhookData.name;
    
    const clientPhone = webhookData.booking?.client?.phone || 
                        webhookData.client?.phone || 
                        webhookData.phone;

    if (!clientName || !clientPhone) {
      console.log('Missing data:', { clientName, clientPhone });
      return res.status(400).json({ 
        error: 'Missing client name or phone in webhook data',
        received: webhookData
      });
    }

    // Format phone number to E.164 if needed
    let formattedPhone = clientPhone;
    if (!clientPhone.startsWith('+')) {
      formattedPhone = '+' + clientPhone;
    }

    // Upsert client (insert or update based on phone - deduplication)
    const { data, error } = await supabase
      .from('clients')
      .upsert(
        {
          phone: formattedPhone,
          name: clientName,
          status: 'active',
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'phone',
          ignoreDuplicates: false 
        }
      )
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Client synced:', clientName, formattedPhone);

    return res.status(200).json({ 
      success: true,
      message: 'Client synced successfully',
      client: { name: clientName, phone: formattedPhone }
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process webhook' 
    });
  }
}
