const fetch = require("node-fetch");
const prisma = require("../prismaClient");

async function geocodeAddress(address) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await res.json();
    if (data.length) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
  return null;
}

async function getActiveCollection() {
  const row = await prisma.activeCollection.findUnique({
    where: { id: 1 }
  });
  return row?.collectionName || "Default";
}

function validateEventFields({ title, type, date, address }) {
  if (!title || !type || !date || !address) {
    throw new Error("title, type, date, address required");
  }
  return date.includes("T") ? date.split("T")[0] : date;
}

async function ensureLatLng({ address, latitude, longitude }) {
  if (latitude && longitude) return { latitude, longitude };
  const geo = await geocodeAddress(address);
  if (!geo) throw new Error("Cannot geocode address");
  return geo;
}

module.exports = { geocodeAddress, getActiveCollection, validateEventFields, ensureLatLng };
