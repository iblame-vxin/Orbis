import * as THREE from "three";

export const GLOBE_RADIUS = 100;

export function polarToVec3(lat: number, lng: number, relAltitude: number, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const r = GLOBE_RADIUS * (1 + relAltitude);
  out.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
  return out;
}

export function sunDirection(date: Date, out = new THREE.Vector3()): THREE.Vector3 {
  const { lat, lng } = subsolarLatLng(date);
  return polarToVec3(lat, lng, 2, out).normalize();
}

export function subsolarLatLng(date: Date): { lat: number; lng: number } {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86400000) + 1;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat, lng: 180 - utcHours * 15 };
}
