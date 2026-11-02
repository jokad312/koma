import { createHash, timingSafeEqual } from "node:crypto";

// Comparaison à temps constant du secret des tâches planifiées (en-tête Authorization: Bearer <CRON_SECRET>, AD-10).
// Les deux valeurs sont réduites à une empreinte de même longueur.
export function secretCronValide(recu: string | null): boolean {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || !recu) return false;
  const m = /^\s*bearer\s+(\S+)\s*$/i.exec(recu);
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}
