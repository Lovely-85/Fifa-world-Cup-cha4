'use strict';

/**
 * Fan Assistant client.
 *
 * Deliberately framework-free: this is a small, focused UI, and a build
 * step (bundler/transpiler) would add failure modes for very little
 * benefit here. Every place that inserts dynamic text into the DOM uses
 * textContent (never innerHTML), which is the primary client-side XSS
 * defense -- see SECURITY.md.
 */

const STATUS_POLL_MS = 25000;
const MAX_HISTORY_TURNS = 12;

/** @type {{role: 'user'|'assistant', text: string}[]} */
let conversationHistory = [];
let currentVenueId = null;
let statusPollTimer = null;
let isSending = false;

const el = {
  venueSelect: document.getElementById('venue-select'),
  statusStrip: document.getElementById('status-strip'),
  modeBadge: document.getElementById('mode-badge'),
  chatLog: document.getElementById('chat-log'),
  composer: document.getElementById('composer'),
  composerInput: document.getElementById('composer-input'),
  sendBtn: document.getElementById('send-btn'),
  toggleContrast: document.getElementById('toggle-contrast'),
  toggleTextSize: document.getElementById('toggle-text-size'),
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function setModeBadge(mode) {
  el.modeBadge.textContent = mode === 'gemini' ? 'Gemini live' : 'Offline reasoning mode';
  el.modeBadge.dataset.mode = mode === 'gemini' ? 'gemini' : 'fallback';
}

/** Splits assistant text on "Gate X" mentions and renders each as a small tag,
 * without ever using innerHTML. */
function renderMessageBody(container, text) {
  const gateMentionPattern = /\bGate\s+([A-Z])\b/g;
  let lastIndex = 0;
  let match;
  while ((match = gateMentionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    container.appendChild(document.createTextNode('Gate '));
    const tag = document.createElement('span');
    tag.className = 'gate-tag';
    tag.textContent = match[1];
    container.appendChild(tag);
    lastIndex = gateMentionPattern.lastIndex;
  }
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function appendMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role}`;
  if (role === 'assistant') {
    renderMessageBody(wrapper, text);
  } else {
    wrapper.textContent = text;
  }
  el.chatLog.appendChild(wrapper);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
  return wrapper;
}

function appendSystemNote(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg system';
  wrapper.textContent = text;
  el.chatLog.appendChild(wrapper);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
  return wrapper;
}

function densityLevelLabel(level) {
  return { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' }[level] || level;
}

async function loadVenues() {
  const venues = await fetchJson('/api/venues');
  el.venueSelect.innerHTML = '';
  for (const venue of venues) {
    const option = document.createElement('option');
    option.value = venue.id;
    option.textContent = `${venue.name} — ${venue.city}`;
    el.venueSelect.appendChild(option);
  }
  if (venues.length > 0) {
    currentVenueId = venues[0].id;
    el.venueSelect.value = currentVenueId;
  }
}

async function refreshStatusStrip() {
  if (!currentVenueId) return;
  try {
    const status = await fetchJson(`/api/venues/${encodeURIComponent(currentVenueId)}/status`);
    el.statusStrip.innerHTML = '';
    for (const gate of status.gates) {
      const chip = document.createElement('div');
      chip.className = 'gate-chip';

      const letter = document.createElement('span');
      letter.className = 'gate-letter';
      letter.dataset.level = gate.densityLevel;
      letter.textContent = gate.gateId;
      letter.setAttribute(
        'aria-label',
        `Gate ${gate.gateId}: ${densityLevelLabel(gate.densityLevel)} density, about ${gate.waitMinutes} minute wait`,
      );

      const meta = document.createElement('span');
      meta.className = 'gate-meta';
      meta.textContent = `${gate.waitMinutes}m`;

      chip.appendChild(letter);
      chip.appendChild(meta);
      el.statusStrip.appendChild(chip);
    }
  } catch (error) {
    // Non-fatal: the chat still works even if the live status strip fails.
    console.error('Failed to refresh status strip', error);
  }
}

function restartStatusPolling() {
  if (statusPollTimer) clearInterval(statusPollTimer);
  refreshStatusStrip();
  statusPollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshStatusStrip();
  }, STATUS_POLL_MS);
}

async function sendMessage(text) {
  if (isSending || !text.trim()) return;
  isSending = true;
  el.sendBtn.disabled = true;

  appendMessage('fan', text);
  conversationHistory.push({ role: 'user', text });
  conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

  const thinkingNote = appendSystemNote('Thinking…');

  try {
    const result = await fetchJson('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: conversationHistory.slice(0, -1) }),
    });
    thinkingNote.remove();
    appendMessage('assistant', result.reply);
    conversationHistory.push({ role: 'assistant', text: result.reply });
    setModeBadge(result.mode);
  } catch (error) {
    thinkingNote.remove();
    appendSystemNote(`Sorry, something went wrong: ${error.message}`);
  } finally {
    isSending = false;
    el.sendBtn.disabled = false;
  }
}

function autoResizeTextarea() {
  el.composerInput.style.height = 'auto';
  el.composerInput.style.height = `${Math.min(el.composerInput.scrollHeight, 128)}px`;
}

function initComposer() {
  el.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = el.composerInput.value;
    el.composerInput.value = '';
    autoResizeTextarea();
    sendMessage(text);
  });

  el.composerInput.addEventListener('input', autoResizeTextarea);
  el.composerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      el.composer.requestSubmit();
    }
  });

  document.querySelectorAll('.quick-action').forEach((button) => {
    button.addEventListener('click', () => sendMessage(button.dataset.prompt));
  });
}

function initAccessibilityControls() {
  el.toggleContrast.addEventListener('click', () => {
    const active = document.body.classList.toggle('high-contrast');
    el.toggleContrast.setAttribute('aria-pressed', String(active));
  });
  el.toggleTextSize.addEventListener('click', () => {
    const active = document.body.classList.toggle('large-text');
    el.toggleTextSize.setAttribute('aria-pressed', String(active));
  });
}

function initVenueSelect() {
  el.venueSelect.addEventListener('change', () => {
    currentVenueId = el.venueSelect.value;
    restartStatusPolling();
  });
}

async function init() {
  initComposer();
  initAccessibilityControls();
  initVenueSelect();

  try {
    await loadVenues();
    restartStatusPolling();
    appendSystemNote(
      'Ask me about gates, crowds, accessibility, transport, or sustainable travel — in any language.',
    );
    setModeBadge('fallback');
  } catch (error) {
    appendSystemNote(`Could not load venue data: ${error.message}`);
  }
}

init();
