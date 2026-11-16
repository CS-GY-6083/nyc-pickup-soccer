// Field photo + credit lookup (client/src/data/field-photos.json, served
// from public/photos/fields). The 12 hand-entered fields have their own
// entry (a real photo, or a stock photo marked as such). Every other field
// (the NYC Open Data import) gets one of the stock photos, chosen by its
// id, and is labelled "Stock photo" like the others.
import photos from '../data/field-photos.json';

const STOCK = Object.values(photos)
  .map((m) => m.photo)
  .filter((p) => p?.stock);

export function fieldMeta(fieldId) {
  return photos[String(fieldId)] ?? null;
}

export function fieldPhoto(fieldId) {
  const own = fieldMeta(fieldId)?.photo;
  if (own) return own;
  return STOCK.length ? STOCK[Math.abs(Number(fieldId) || 0) % STOCK.length] : null;
}
