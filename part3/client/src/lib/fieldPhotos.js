// Field photo + credit lookup (client/src/data/field-photos.json, served
// from public/photos/fields). Every field has one; stock photos are marked.
import photos from '../data/field-photos.json';

export function fieldMeta(fieldId) {
  return photos[String(fieldId)] ?? null;
}

export function fieldPhoto(fieldId) {
  return fieldMeta(fieldId)?.photo ?? null;
}
