---
description: Foreign key relationship verification against OpenAPI spec
tags: [database, foreign-keys, verification, openapi]
audience: { human: 70, agent: 30 }
purpose: { findings: 70, reference: 30 }
---

# Foreign Key Verification

Verification of all foreign key relationships in the database design against the OpenAPI spec at `/mnt/c/Users/gavin/Downloads/openapi`.

## Primary Key Types by Entity

| Entity | Primary Key | Type | Spec Line |
|--------|-------------|------|-----------|
| **manufacturers** | uuid | STRING | 8495 |
| **vehicles** (game_vehicle) | uuid | STRING | 8817 |
| **items** (game_item) | uuid | STRING | 2403 |
| **ports** (game_vehicle_port) | uuid | STRING | 8720 |
| **celestial_objects** | id | **INTEGER** ⚠️ | 9946 |
| **galactapedia** | id | **INTEGER** ⚠️ | 9836 |
| **shops** | N/A | **DEPRECATED** ❌ | - |

⚠️ **ISSUE FOUND**: Database design uses `celestial_objects.uuid TEXT` but API spec shows `celestial_object.id INTEGER`.

## Foreign Key Relationships

### 1. Vehicles → Manufacturers

**Database Design:**
```sql
vehicles.manufacturer_uuid TEXT REFERENCES manufacturers(uuid)
```

**OpenAPI Spec (line 8833-8834):**
```yaml
manufacturer:
  $ref: '#/components/schemas/manufacturer_link'
```

**Status:** ✅ CORRECT

---

### 2. Items → Manufacturers

**Database Design:**
```sql
items.manufacturer_uuid TEXT REFERENCES manufacturers(uuid)
```

**OpenAPI Spec (line 2453-2456):**
```yaml
manufacturer:
  oneOf:
    - $ref: '#/components/schemas/manufacturer_link'
  nullable: true
```

**Status:** ✅ CORRECT (nullable is handled)

---

### 3. Hardpoints → Vehicles

**Database Design:**
```sql
hardpoints.vehicle_uuid TEXT REFERENCES vehicles(uuid)
```

**OpenAPI Spec (line 9452-9457):**
```yaml
ports:
  description: 'Only included on show route, excluded from index route.'
  type: array
  items:
    $ref: '#/components/schemas/game_vehicle_port'
  nullable: true
```

**Status:** ✅ CORRECT (ports nested in vehicle response, requires extraction during sync)

---

### 4. Hardpoints → Items (Equipped Item)

**Database Design:**
```sql
hardpoints.equipped_item_uuid TEXT REFERENCES items(uuid)
```

**OpenAPI Spec (line 8751-8755):**
```yaml
equipped_item:
  oneOf:
    - $ref: '#/components/schemas/game_port_item'
  nullable: true
```

**Status:** ✅ CORRECT (nullable is handled)

---

### 5. Hardpoints → Hardpoints (Self-Referencing)

**Database Design:**
```sql
hardpoints.parent_hardpoint_id INTEGER REFERENCES hardpoints(id)
```

**OpenAPI Spec (line 8756-8760):**
```yaml
ports:
  type: array
  items:
    $ref: '#/components/schemas/game_vehicle_port'
  nullable: true
```

**Status:** ✅ CORRECT (recursive nesting supported)

**Note:** Database uses INTEGER surrogate key for `hardpoints.id` since ports don't have their own UUIDs in isolation - they're nested in vehicle responses. The `hardpoints.uuid` field stores the API's port UUID for reference.

---

### 6. Celestial Objects → Star Systems

**Database Design:**
```sql
celestial_objects.star_system_uuid TEXT REFERENCES celestial_objects(uuid)
```

**OpenAPI Spec (line 9950, 10006-10018):**
```yaml
system_id:
  type: integer
starsystem:
  properties:
    id:
      type: integer
      nullable: true
```

**Status:** ❌ **INCORRECT** - Should be:
```sql
celestial_objects.star_system_id INTEGER REFERENCES celestial_objects(id)
```

---

### 7. Celestial Objects → Parent Object (Self-Referencing)

**Database Design:**
```sql
celestial_objects.parent_uuid TEXT REFERENCES celestial_objects(uuid)
```

**OpenAPI Spec (line 10004):**
```yaml
parent_id:
  type: integer
```

**Status:** ❌ **INCORRECT** - Should be:
```sql
celestial_objects.parent_id INTEGER REFERENCES celestial_objects(id)
```

---

### 8. Vehicle Loaners (Many-to-Many)

**Database Design:**
```sql
vehicle_loaners.vehicle_uuid TEXT REFERENCES vehicles(uuid)
vehicle_loaners.loaner_uuid TEXT REFERENCES vehicles(uuid)
```

**OpenAPI Spec:** No explicit loaners field found in game_vehicle schema.

**Status:** ⚠️ **UNCERTAIN** - Loaners may be in ShipMatrix data (separate endpoint `/api/shipmatrix/vehicles`) rather than game_vehicle data.

**Action needed:** Verify loaners data source.

---

### 9. Shops → Celestial Objects (Location)

**Database Design:**
```sql
shops.location_uuid TEXT REFERENCES celestial_objects(uuid)
```

**OpenAPI Spec:** Shop schema not yet verified.

**Status:** ⚠️ **NEEDS VERIFICATION**

**Action needed:** Find shop schema in OpenAPI spec and verify location FK type (likely INTEGER to match celestial_objects.id).

---

### 10. Shop Inventory (Many-to-Many)

**Database Design:**
```sql
shop_inventory.shop_uuid TEXT REFERENCES shops(uuid)
shop_inventory.item_uuid TEXT REFERENCES items(uuid)
```

**OpenAPI Spec:** Not yet verified.

**Status:** ⚠️ **NEEDS VERIFICATION**

**Expected:** shop_uuid might be INTEGER, item_uuid should be STRING (UUID).

---

## Summary of Issues

### Critical Issues (Must Fix)

1. **Celestial Objects Primary Key Type**
   - **Current:** `celestial_objects.uuid TEXT PRIMARY KEY`
   - **Should be:** `celestial_objects.id INTEGER PRIMARY KEY`
   - **Impact:** All celestial object FKs are wrong type

2. **Celestial Objects Foreign Keys**
   - **Current:** `star_system_uuid TEXT`, `parent_uuid TEXT`
   - **Should be:** `star_system_id INTEGER`, `parent_id INTEGER`
   - **Impact:** JOIN queries will fail

3. **Galactapedia Primary Key Type**
   - **Current:** `galactapedia.uuid TEXT PRIMARY KEY`
   - **Should be:** `galactapedia.id INTEGER PRIMARY KEY`
   - **Impact:** Primary key type mismatch

### Deprecated/Removed Features

4. **Shops and Shop Inventory**
   - **Status:** DEPRECATED in API
   - **API Note:** "shop data is not available in the source files anymore"
   - **Action:** Remove shops and shop_inventory tables from design

### Uncertain Items (Need Verification)

5. **Vehicle Loaners Data Source**
   - Not found in game_vehicle schema
   - May be in ShipMatrix API (/api/shipmatrix/vehicles)
   - Verify before implementing

## Corrected Schema for Celestial Objects

```sql
CREATE TABLE celestial_objects (
    id INTEGER PRIMARY KEY,  -- Changed from uuid TEXT
    code TEXT,
    name TEXT NOT NULL,
    slug TEXT,  -- May not exist in API
    type TEXT NOT NULL,
    designation TEXT,
    star_system_id INTEGER REFERENCES celestial_objects(id) ON DELETE CASCADE,  -- Changed from star_system_uuid TEXT
    parent_id INTEGER REFERENCES celestial_objects(id) ON DELETE CASCADE,  -- Changed from parent_uuid TEXT
    habitable BOOLEAN,
    fairchanceact BOOLEAN,
    age INTEGER,
    description TEXT,
    distance DECIMAL(15,2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    axial_tilt DECIMAL(10,6),
    orbit_period DECIMAL(15,2),
    size DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_celestial_objects_type ON celestial_objects(type);
CREATE INDEX idx_celestial_objects_star_system ON celestial_objects(star_system_id);
CREATE INDEX idx_celestial_objects_parent ON celestial_objects(parent_id);
CREATE INDEX idx_celestial_objects_code ON celestial_objects(code);
```

## Corrected Schema for Shops

**Needs verification - placeholder based on likely structure:**

```sql
CREATE TABLE shops (
    id INTEGER PRIMARY KEY,  -- Likely INTEGER, not UUID
    name TEXT NOT NULL,
    slug TEXT,
    type TEXT,
    location_id INTEGER REFERENCES celestial_objects(id) ON DELETE SET NULL,  -- Changed from location_uuid
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps

1. ✅ Verify celestial_object schema (DONE - uses INTEGER id)
2. ⬜ Find and verify shop schema in OpenAPI spec
3. ⬜ Find and verify galactapedia schema
4. ⬜ Verify loaners data source (game_vehicle vs shipmatrix)
5. ⬜ Update database design document with corrected schemas
6. ⬜ Update sync implementation plan to handle INTEGER vs UUID differences
