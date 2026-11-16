// MapLibre GL, loaded on demand so it stays out of the main bundle.
// Tiles: OpenFreeMap (no key). Attribution stays visible on every map.
let loading;

export function loadMapLibre() {
  if (!loading) {
    loading = Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    ]).then(([mod, , worker]) => {
      const lib = mod.default ?? mod;
      lib.setWorkerUrl?.(worker.default);
      return lib;
    });
    loading.catch(() => {
      loading = undefined; // let a later visit try again
    });
  }
  return loading;
}

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export const NYC_CENTER = [-73.94, 40.71];

/** MapLibre paints need sRGB; resolve a CSS colour (tokens are OKLCH) to rgb(). */
export function cssColor(value, fallback = '#2f7d4f') {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = fallback;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return fallback;
  }
}

export function tokenColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? cssColor(v, fallback) : fallback;
}

/** A circle of radiusKm around [lng, lat] as a GeoJSON polygon. */
export function circlePolygon([lng, lat], radiusKm, steps = 72) {
  const coords = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
