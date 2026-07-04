// topbar.js — custom frameless titlebar + Config menu wiring (PresenceVTT).
//
// The DM window is frameless (main.js sets frame:false), so the app draws its own
// titlebar: brand + Help + Config + window controls (minimize / maximize / close).
// This module wires all of that, plus the Config dropdown, which houses:
//   • Idioma / Language     — reuses #lang-switch (i18n.js owns the actual switching)
//   • Dispositivo de áudio  — physical output device picker (soundboard.js owns setSinkId)
//   • Configurações de atalho — opens the existing shortcut legend
//   • Verificar atualizações — manual update check (electron-updater via main.js)
//
// DM window only — no-ops in the projection (?mode=player). Plain <script>, no ES
// modules; loaded after i18n.js. Must be listed in package.json build.files.

(function () {
  'use strict';

  var isPlayer = new URLSearchParams(location.search).get('mode') === 'player';
  if (isPlayer) return; // projection has no titlebar / config

  var api = window.electronAPI || null;
  function $(id) { return document.getElementById(id); }
  // Translate a JS-composed string through i18n's t() when available.
  function tt(s) { return (typeof window.t === 'function') ? window.t(s) : s; }

  function init() {
    wireWindowControls();
    wireConfigMenu();
    wireShortcuts();
    wireUpdates();
    wireAudioDevices();
  }

  // ── Window controls (min / maximize / close) ───────────────────────────────
  function wireWindowControls() {
    var min = $('tb-min'), max = $('tb-max'), close = $('tb-close');
    if (!api || !api.minimizeWindow) {
      // Plain browser (npx serve) — no frameless window to control; hide the cluster.
      var wc = document.querySelector('#app-titlebar .tb-window-controls');
      if (wc) wc.style.display = 'none';
      return;
    }
    if (min) min.onclick = function () { api.minimizeWindow(); };
    if (max) max.onclick = function () { api.toggleMaximizeWindow(); };
    if (close) close.onclick = function () { api.closeWindow(); };

    function reflectMax(isMax) {
      if (!max) return;
      max.title = tt(isMax ? 'Restaurar' : 'Maximizar');
      var svg = max.querySelector('svg');
      if (svg) {
        svg.innerHTML = isMax
          ? '<rect x="2.5" y="4" width="5.5" height="5.5"/><polyline points="4.5,4 4.5,2 9.5,2 9.5,7 8,7" fill="none"/>'
          : '<rect x="2.5" y="2.5" width="7" height="7"/>';
      }
    }
    if (api.isWindowMaximized) api.isWindowMaximized().then(reflectMax).catch(function () {});
    if (api.onWindowMaximizedChanged) api.onWindowMaximizedChanged(reflectMax);
  }

  // ── Config dropdown open/close ─────────────────────────────────────────────
  var menu, btnConfig;
  function openConfig() {
    if (!menu) return;
    menu.hidden = false;
    if (btnConfig) btnConfig.classList.add('active');
    refreshAudioDevices(); // pick up newly plugged devices each time it opens
  }
  function closeConfig() {
    if (!menu) return;
    menu.hidden = true;
    if (btnConfig) btnConfig.classList.remove('active');
  }
  function wireConfigMenu() {
    menu = $('config-menu');
    btnConfig = $('btn-config');
    if (!menu || !btnConfig) return;
    btnConfig.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden ? openConfig() : closeConfig();
    });
    // Close on outside click / Escape.
    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || btnConfig.contains(e.target)) return;
      closeConfig();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeConfig();
    });
  }

  // ── Shortcuts → open the existing legend ───────────────────────────────────
  function wireShortcuts() {
    var btn = $('cfg-shortcuts');
    if (!btn) return;
    btn.onclick = function () {
      closeConfig();
      var legend = $('shortcut-legend');
      var closed = !legend || getComputedStyle(legend).display === 'none';
      if (closed && typeof window.toggleLegend === 'function') window.toggleLegend();
    };
  }

  // ── Updates: manual check + toast (moved out of the inline script) ──────────
  function setUpdMsg(text) { var el = $('cfg-update-msg'); if (el) el.textContent = text || ''; }

  function wireUpdates() {
    var checkBtn = $('cfg-check-updates');
    if (checkBtn) {
      checkBtn.onclick = function () {
        if (!api || !api.checkForUpdates) {
          setUpdMsg(tt('Atualização automática indisponível nesta versão.'));
          return;
        }
        setUpdMsg(tt('Verificando atualizações…'));
        checkBtn.disabled = true;
        api.checkForUpdates().then(function (res) {
          if (res && !res.supported) {
            var m = res.reason === 'dev' ? 'Atualização automática indisponível no modo de desenvolvimento.'
              : res.reason === 'portable' ? 'Versão portátil: baixe a nova versão manualmente.'
              : res.reason === 'mac' ? 'Atualização automática indisponível no macOS.'
              : res.reason === 'error' ? 'Falha ao verificar atualizações.'
              : 'Atualização automática indisponível nesta versão.';
            setUpdMsg(tt(m));
          }
          // supported: the result arrives via onUpdateStatus below.
        }).catch(function () {
          setUpdMsg(tt('Falha ao verificar atualizações.'));
        }).then(function () { checkBtn.disabled = false; });
      };
    }

    if (!api || !api.onUpdateStatus) return;
    var toast = $('update-toast'), msg = $('update-toast-msg'),
        btn = $('update-toast-btn'), dismiss = $('update-toast-dismiss');
    if (btn) btn.onclick = function () { api.installUpdate(); };
    if (dismiss) dismiss.onclick = function () { toast.classList.remove('on'); };

    api.onUpdateStatus(function (d) {
      if (!d) return;
      var ver = d.version ? ' ' + d.version : '';
      switch (d.status) {
        case 'checking':
          setUpdMsg(tt('Verificando atualizações…'));
          break;
        case 'available':
          if (msg) msg.textContent = tt('Baixando atualização') + ver + '…';
          if (btn) btn.style.display = 'none';
          if (toast) toast.classList.add('on');
          setUpdMsg('');
          break;
        case 'downloading':
          if (msg) msg.textContent = tt('Baixando atualização') + '… ' + (d.percent || 0) + '%';
          if (btn) btn.style.display = 'none';
          if (toast) toast.classList.add('on');
          break;
        case 'ready':
          if (msg) msg.textContent = tt('Atualização pronta') + ver + '.';
          if (btn) btn.style.display = '';
          if (toast) toast.classList.add('on');
          break;
        case 'none':
          setUpdMsg(tt('Você está atualizado.'));
          break;
        case 'error':
          setUpdMsg(tt('Falha ao verificar atualizações.'));
          break;
      }
    });
  }

  // ── Audio output device picker (physical sink) ─────────────────────────────
  var deviceSelect;
  function wireAudioDevices() {
    deviceSelect = $('cfg-audio-device');
    if (!deviceSelect) return;
    deviceSelect.addEventListener('change', function () {
      if (typeof window.sbSetAudioSink === 'function') window.sbSetAudioSink(deviceSelect.value);
    });
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudioDevices);
    }
    refreshAudioDevices();
  }

  function refreshAudioDevices() {
    if (!deviceSelect || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
      var outputs = devices.filter(function (d) { return d.kind === 'audiooutput'; });
      var current = (typeof window.sbGetAudioSink === 'function') ? window.sbGetAudioSink() : '';
      deviceSelect.innerHTML = '';

      if (!outputs.length) {
        var none = document.createElement('option');
        none.value = '';
        none.textContent = tt('Sem dispositivos de áudio disponíveis');
        deviceSelect.appendChild(none);
        deviceSelect.disabled = true;
        return;
      }
      deviceSelect.disabled = false;

      var seenDefault = false;
      outputs.forEach(function (d, i) {
        var opt = document.createElement('option');
        opt.value = d.deviceId;
        // 'default' deviceId → "system default"; otherwise the label, or a fallback.
        if (d.deviceId === 'default') { opt.textContent = tt('Dispositivo padrão do sistema'); seenDefault = true; }
        else opt.textContent = d.label || (tt('Saída de áudio') + ' ' + (i + 1));
        deviceSelect.appendChild(opt);
      });

      // If nothing stored yet and there is no explicit 'default' entry, prepend one
      // that maps to Chromium's default sink.
      if (!seenDefault) {
        var def = document.createElement('option');
        def.value = 'default';
        def.textContent = tt('Dispositivo padrão do sistema');
        deviceSelect.insertBefore(def, deviceSelect.firstChild);
      }

      // Reflect the stored choice; fall back to the default sink.
      var match = Array.prototype.some.call(deviceSelect.options, function (o) { return o.value === current; });
      deviceSelect.value = match ? current : (current ? current : 'default');
      if (!match && !current) deviceSelect.value = 'default';
    }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
