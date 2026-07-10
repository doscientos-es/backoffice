-- Add optional logo URL to clients
-- Stores the public URL of the client's logo uploaded to Supabase Storage.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

-- Create public storage bucket for client logos (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  true,
  2097152, -- 2 MB max (upload is resized to 480px first, actual size will be much smaller)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload/update/delete their own logos.
CREATE POLICY "Authenticated users can upload client logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "Authenticated users can update client logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "Authenticated users can delete client logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "Public read for client logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'client-logos');
