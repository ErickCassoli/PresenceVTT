// blackout.js — instant projection blackout (PresenceVTT addition).
//
// Part of PresenceVTT, a fork of Evermist (MIT, Copyright (c) 2026 Hinnful).
//
// The DM toggles blackout; the projection window covers EVERYTHING (map/fog/grid)
// with an opaque black layer in <100ms. The DM never goes black — it shows a
// "BLACKOUT ON" badge instead. State is re-synced when the projection (re)opens.
//
// Loaded in both windows (plain <script>, globals referenced lazily). DM-only
// functions simply aren't called in the projection, and vice-versa.

let blackoutOn = false; // authoritative on the DM; mirrors last-applied state on the player

// ─── DM side ──────────────────────────────────────────────────────────────────
function blackoutToggle() {
  blackoutOn = !blackoutOn;
  blackoutSendToPlayer();
  blackoutUpdateDMBadge();
}

function blackoutSendToPlayer() {
  if (typeof playerWindow !== 'undefined' && playerWindow && !playerWindow.closed) {
    playerWindow.postMessage({ type: 'blackout', on: blackoutOn }, '*');
  }
}

function blackoutUpdateDMBadge() {
  const badge = document.getElementById('blackout-indicator');
  if (badge) badge.classList.toggle('on', blackoutOn);
  const btn = document.getElementById('btn-blackout');
  if (btn) btn.classList.toggle('active', blackoutOn);
}

// Called when the player signals ready (PLAYER_READY / need-map) so a freshly
// (re)opened projection inherits the current blackout state instead of flashing
// the map.
function blackoutResyncToPlayer() {
  blackoutSendToPlayer();
}

// ─── Player side ──────────────────────────────────────────────────────────────
function setPlayerBlackout(on) {
  blackoutOn = !!on;
  const cover = document.getElementById('blackout');
  if (cover) cover.classList.toggle('on', blackoutOn);
}
