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
    
    // Extract client info from EasyWeek webhook format
    // Based on actual webhook structure: customer_full_name, customer_phone
    const clientName = webhookData.customer_full_name || 
                       webhookData.customer_name ||
                       `${webhookData.customer_first_name || ''} ${webhookData.customer_last_name || ''}`.trim();
    
    const clientPhone = webhookData.customer_phone || 
                        webhookData['customer_attributes.customer_phone'];
    
    if (!clientName || !clientPhone) {
      console.log('Missing data:', { clientName, clientPhone });
      return res.status(400).json({ 
        error: 'Missing client name or phone in webhook data',
        received: webhookData
      });
    }
    
    // Format phone number to E.164 (already in correct format from EasyWeek)
    let formattedPhone = clientPhone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    // Upsert client (insert or update based on phone - automatic deduplication)
    // The 'phone' column has a UNIQUE constraint, so upsert handles deduplication
    const { data, error } = await supabase
      .from('clients')
      .upsert(
        {
          phone: formattedPhone,
          name: clientName.trim(),
          status: 'active',
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'phone',
          ignoreDuplicates: false // Update existing record instead of ignoring
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
      client: { name: clientName, phone: formattedPhone },
      action: data && data.length > 0 ? 'upserted' : 'created'
    });
    
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process webhook' 
    });
  }
}
