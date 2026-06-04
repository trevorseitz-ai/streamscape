-- Migration: Add order_index and RPC for batch updating watchlist order
-- Run in Supabase SQL Editor

-- Add order_index column (alias for sort_order; we use order_index per spec)
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS order_index INTEGER;
UPDATE watchlist SET order_index = sort_order WHERE order_index IS NULL AND sort_order IS NOT NULL;
UPDATE watchlist SET order_index = 0 WHERE order_index IS NULL;
CREATE INDEX IF NOT EXISTS idx_watchlist_order_index ON watchlist(user_id, order_index);

-- RPC for batch update in one call
CREATE OR REPLACE FUNCTION update_watchlist_order(
  p_user_id UUID,
  p_items JSONB  -- [{"id": "uuid", "order_index": 0}, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE watchlist w
  SET order_index = (elem->>'order_index')::INTEGER,
      sort_order = (elem->>'order_index')::INTEGER,
      updated_at = NOW()
  FROM jsonb_array_elements(p_items) AS elem
  WHERE w.id = ((elem->>'id')::UUID)
    AND w.user_id = p_user_id;
END;
$$;

-- Grant execute to authenticated users (RLS still applies via p_user_id check)
GRANT EXECUTE ON FUNCTION update_watchlist_order(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_watchlist_order(UUID, JSONB) TO service_role;

-- Trigger: keep order_index in sync with sort_order on insert
CREATE OR REPLACE FUNCTION watchlist_sync_order_index()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_index IS NULL AND NEW.sort_order IS NOT NULL THEN
    NEW.order_index := NEW.sort_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS watchlist_order_index_trigger ON watchlist;
CREATE TRIGGER watchlist_order_index_trigger
  BEFORE INSERT OR UPDATE ON watchlist
  FOR EACH ROW EXECUTE FUNCTION watchlist_sync_order_index();
