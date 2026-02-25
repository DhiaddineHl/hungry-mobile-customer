/*
  # Create user_addresses table

  ## Summary
  Creates a table to store user delivery addresses with location data, address type,
  labeling, and detailed info (floor, door, additional notes).

  ## New Tables
  - `user_addresses`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `label` (text: 'home' | 'work' | 'custom')
    - `custom_label` (text, nullable - for custom label names)
    - `address_type` (text: 'apartment' | 'office' | 'house' | 'other')
    - `address_text` (text - full address string from geocoding)
    - `latitude` (float8)
    - `longitude` (float8)
    - `floor_number` (text, nullable)
    - `door_number` (text, nullable)
    - `additional_info` (text, nullable)
    - `is_default` (boolean, default false)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only access their own addresses
*/

CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'home',
  custom_label text,
  address_type text NOT NULL DEFAULT 'apartment',
  address_text text NOT NULL DEFAULT '',
  latitude float8,
  longitude float8,
  floor_number text,
  door_number text,
  additional_info text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON user_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON user_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON user_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON user_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses(user_id);
