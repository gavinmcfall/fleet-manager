-- Drop commodity_shop_listings — dead schema, never populated or queried
-- Table was created in 0064 but has no corresponding queries in queries.ts,
-- no route references, and no extraction script. Dropped to reduce schema noise.

DROP INDEX IF EXISTS idx_commodity_shop_commodity;
DROP INDEX IF EXISTS idx_commodity_shop_shop;
DROP TABLE IF EXISTS commodity_shop_listings;
