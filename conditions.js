// conditions.js — resolver for token condition markers (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// The condition/range PALETTES now live in systems.js (per game system) and are exposed as
// the globals CONDITIONS and RANGE_BANDS, swapped by applyGameSystem(). This file just
// resolves a stored id → its palette entry, so a token that stores condition ids stays
// decoupled from which system is active. PURE lookup, no logic, no rules. Loaded after
// systems.js (which declares the globals).

function conditionById(id) {
  if (typeof CONDITIONS === 'undefined') return null;
  for (const c of CONDITIONS) if (c.id === id) return c;
  return null;
}

function rangeBandById(id) {
  if (typeof RANGE_BANDS === 'undefined') return null;
  for (const b of RANGE_BANDS) if (b.id === id) return b;
  return null;
}
