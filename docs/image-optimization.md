# Image Optimization Plan

## Current State

Ship images are loaded directly from FleetYards CDN:
- URLs like: `https://cdn.fleetyards.net/uploads/model/store_image/...`
- No local caching or optimization
- Images refetch on every page reload
- Various sizes (some very large)

## Problems

1. **No Browser Caching** - Images reload on every refresh
2. **No Size Optimization** - Full-size images used everywhere
3. **No Format Optimization** - JPG/PNG instead of WebP
4. **No Lazy Loading** - All images load immediately

## Recommended Solutions

### Option 1: Browser-Side Improvements (Quick Win)

**Add to frontend:**
1. **Lazy Loading** - Use `loading="lazy"` attribute on `<img>` tags
2. **Cache Headers** - Configure backend to proxy images with cache headers
3. **Responsive Images** - Use `srcset` for different sizes

**Changes needed:**
- Update `<img>` tags in FleetTable and ShipDB components
- Add image proxy endpoint in backend to set cache headers

**Pros:** Quick to implement, improves performance immediately
**Cons:** Still loading full images, no format optimization

### Option 2: Image Proxy Service (Medium Effort)

**Add backend image proxy that:**
1. Proxies FleetYards CDN images
2. Converts to WebP on-the-fly
3. Resizes based on query params
4. Caches converted images locally

**Example:**
```
GET /api/images/{ship_slug}?size=thumbnail → 150x150 WebP
GET /api/images/{ship_slug}?size=medium    → 400x300 WebP
GET /api/images/{ship_slug}?size=full      → Original WebP
```

**Pros:** Optimal format/size, local caching, responsive
**Cons:** Storage space needed, processing overhead on first load

### Option 3: Pre-Download & Convert (High Effort)

**During ship sync:**
1. Download all images from FleetYards
2. Convert to WebP at multiple sizes
3. Store in `data/images/` directory
4. Serve via static file handler

**Directory structure:**
```
data/images/
  thumbnails/
    100i.webp (150x150)
    carrack.webp
  medium/
    100i.webp (400x300)
    carrack.webp
  full/
    100i.webp (original size)
    carrack.webp
```

**Pros:** Fastest load times, complete control, no external dependency
**Cons:** Significant storage (~500MB), longer sync time, complexity

## Recommendation

**Start with Option 1 (Browser-Side)** for immediate wins:

### Phase 1: Lazy Loading + Cache Headers
```jsx
// FleetTable.jsx & ShipDB.jsx
<img
  src={ship.image_url}
  alt={ship.name}
  loading="lazy"
  className="..."
/>
```

Add to backend:
```go
// Cache image responses for 24 hours
w.Header().Set("Cache-Control", "public, max-age=86400")
```

### Phase 2: Image Proxy (if needed)
Only implement if Phase 1 doesn't provide sufficient improvement.

## Implementation Checklist

- [ ] Add `loading="lazy"` to all ship images
- [ ] Configure cache headers in backend
- [ ] Test browser caching behavior
- [ ] Measure performance improvement
- [ ] Decide if further optimization needed
- [ ] (Optional) Implement image proxy service
- [ ] (Optional) Add image download to sync process

## Performance Metrics

**Before optimization:**
- Page load: ~2-3s
- Image refetch on refresh: Yes
- Total bandwidth: ~5MB per page

**After Phase 1 (expected):**
- Page load: ~1-2s
- Image refetch on refresh: No (cached)
- Total bandwidth: ~100KB per page (after first load)

## Notes

- FleetYards CDN is reliable - external dependency is acceptable
- WebP support is universal in modern browsers (95%+ support)
- Lazy loading is native browser feature (no libraries needed)
- Image proxy could use `github.com/disintegration/imaging` for Go
