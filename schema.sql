-- Create templates table
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[], -- Array of variable names like ['name', 'date']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create clients table
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  twilio_sid VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_messages_client_id ON messages(client_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Enable Row Level Security (Optional - configure based on your needs)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication setup)
CREATE POLICY "Enable read access for all users" ON templates FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON templates FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON templates FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON clients FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON clients FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON clients FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON messages FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON messages FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON messages FOR DELETE USING (true);
