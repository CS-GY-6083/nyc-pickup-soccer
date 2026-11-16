// Keyless map links (plain <a> links, no embeds, so pages work offline).
//   googleMapsUrl({ lat, lng })            Google Maps search at a point
//   googleMapsUrl({ query: 'McCarren Park, Bedford Ave & N 12th St' })
//   osmUrl({ lat, lng })                   OpenStreetMap with a marker
export function googleMapsUrl({ lat, lng, query }) {
  const q = lat != null && lng != null ? `${lat},${lng}` : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function osmUrl({ lat, lng, zoom = 17 }) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
