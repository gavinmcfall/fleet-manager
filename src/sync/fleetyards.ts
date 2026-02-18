/**
 * FleetYards API client — image-only sync.
 * Ported from internal/fleetyards/client.go
 *
 * FleetYards is retained solely for store images (ships + paints).
 * All ship data (specs, dimensions, pricing) comes from SC Wiki.
 */

import {
  updateVehicleImages,
  updatePaintImages,
  getVehicleSlugsWithPaints,
  getPaintsByVehicleSlug,
  insertSyncHistory,
  updateSyncHistory,
} from "../db/queries";

// --- Types ---

interface ShipImages {
  slug: string;
  imageURL: string;
  small: string;
  medium: string;
  large: string;
}

interface PaintImages {
  name: string;
  slug: string;
  imageURL: string;
  small: string;
  medium: string;
  large: string;
}

interface APIShip {
  slug: string;
  media?: {
    storeImage?: {
      source: string;
      small: string;
      medium: string;
      large: string;
    };
  };
}

interface APIPaint {
  name: string;
  slug: string;
  media?: {
    storeImage?: {
      source: string;
      small: string;
      medium: string;
      large: string;
    };
  };
}

// --- HTTP helpers ---

const RATE_LIMIT_MS = 500;

async function fyFetch(url: string): Promise<unknown> {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FleetManager/1.0",
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`FleetYards HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }

  return resp.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Ship image sync ---

async function fetchAllShipImages(baseURL: string): Promise<ShipImages[]> {
  const allImages: ShipImages[] = [];
  let page = 1;
  const perPage = 50;

  for (;;) {
    const url = `${baseURL}/v1/models?page=${page}&perPage=${perPage}`;
    const data = (await fyFetch(url)) as APIShip[];

    if (data.length === 0) break;

    for (const ship of data) {
      const img = ship.media?.storeImage;
      if (!img) continue;
      if (!img.source && !img.small && !img.medium && !img.large) continue;

      allImages.push({
        slug: ship.slug,
        imageURL: img.source,
        small: img.small,
        medium: img.medium,
        large: img.large,
      });
    }

    console.log(`[fleetyards] Ship images page ${page}: ${data.length} ships, ${allImages.length} images total`);

    if (data.length < perPage) break;
    page++;
    await delay(RATE_LIMIT_MS);
  }

  return allImages;
}

export async function syncShipImages(db: D1Database, baseURL: string): Promise<void> {
  const syncID = await insertSyncHistory(db, 2, "images", "running"); // 2 = fleetyards

  try {
    const images = await fetchAllShipImages(baseURL);
    let count = 0;

    for (const img of images) {
      try {
        await updateVehicleImages(db, img.slug, img.imageURL, img.small, img.medium, img.large);
        count++;
      } catch (err) {
        console.warn(`[fleetyards] Failed to update images for ${img.slug}:`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[fleetyards] Ship image sync complete: ${count}/${images.length} updated`);
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

// --- Paint image sync ---

async function fetchPaintImages(baseURL: string, vehicleSlug: string): Promise<PaintImages[]> {
  const url = `${baseURL}/v1/models/${vehicleSlug}/paints`;
  const data = (await fyFetch(url)) as APIPaint[];

  const paints: PaintImages[] = [];
  for (const p of data) {
    const img = p.media?.storeImage;
    if (!img) continue;
    if (!img.source && !img.small && !img.medium && !img.large) continue;

    paints.push({
      name: p.name,
      slug: p.slug,
      imageURL: img.source,
      small: img.small,
      medium: img.medium,
      large: img.large,
    });
  }

  return paints;
}

export async function syncPaintImages(db: D1Database, baseURL: string): Promise<void> {
  const slugs = await getVehicleSlugsWithPaints(db);
  if (slugs.length === 0) {
    console.log("[fleetyards] No vehicles with paints to fetch images for");
    return;
  }

  console.log(`[fleetyards] Fetching paint images for ${slugs.length} vehicles`);
  let imagesSynced = 0;

  for (const vehicleSlug of slugs) {
    try {
      const fyPaints = await fetchPaintImages(baseURL, vehicleSlug);
      if (fyPaints.length === 0) continue;

      const dbPaints = await getPaintsByVehicleSlug(db, vehicleSlug);

      for (const fyPaint of fyPaints) {
        const matched = matchPaintByName(fyPaint.name, dbPaints);
        if (!matched) continue;

        await updatePaintImages(
          db,
          matched.class_name,
          fyPaint.imageURL,
          fyPaint.small,
          fyPaint.medium,
          fyPaint.large,
        );
        imagesSynced++;
      }
    } catch {
      // Many vehicles won't have paints on FleetYards — this is expected
    }

    await delay(RATE_LIMIT_MS);
  }

  console.log(`[fleetyards] Paint image sync complete: ${imagesSynced} images updated`);
}

// --- Paint name matching ---

function matchPaintByName(
  fyName: string,
  dbPaints: Array<{ name: string; class_name: string }>,
): { name: string; class_name: string } | null {
  const fyNorm = normalizePaintName(fyName);

  for (const p of dbPaints) {
    const dbNorm = normalizePaintName(p.name);
    if (fyNorm === dbNorm) return p;
    if (dbNorm.includes(fyNorm) || fyNorm.includes(dbNorm)) return p;
  }

  return null;
}

function normalizePaintName(name: string): string {
  let n = name.toLowerCase().trim();
  n = n.replace(/ livery$/, "");
  n = n.replace(/ paint$/, "");
  n = n.replace(/ skin$/, "");
  return n;
}
