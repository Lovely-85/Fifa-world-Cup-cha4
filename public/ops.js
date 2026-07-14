'use strict';

let currentVenueId = null;

const el = {
  venueSelect: document.getElementById('venue-select'),
  modeBadge: document.getElementById('mode-badge'),
  briefingList: document.getElementById('briefing-list'),
  gatesTbody: document.getElementById('gates-tbody'),
  transportTbody: document.getElementById('transport-tbody'),
  accessibilityNote: document.getElementById('accessibility-note'),
  refreshBtn: document.getElementById('refresh-btn'),
};

async function fetchJson(url) {
  const response = await fetch(url);
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

async function loadStatus() {
  if (!currentVenueId) return;
  const status = await fetchJson(`/api/venues/${encodeURIComponent(currentVenueId)}/status`);

  el.gatesTbody.innerHTML = '';
  for (const gate of status.gates) {
    const row = document.createElement('tr');
    const cells = [
      gate.gateId,
      `${gate.densityLevel} (${gate.densityPct}%)`,
      `${gate.waitMinutes}m`,
      gate.elevatorOperational ? 'OK' : 'DOWN',
    ];
    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    }
    el.gatesTbody.appendChild(row);
  }

  el.transportTbody.innerHTML = '';
  const transportRows = [
    ['Shuttle ETA', `${status.transport.shuttleEtaMinutes} min`],
    ['Parking occupancy', `${status.transport.parkingOccupancyPct}%`],
    ['Transit status', status.transport.transitStatus.replace('_', ' ')],
    ['Rideshare wait', `${status.transport.rideshareZoneWaitMinutes} min`],
    ['Heat/altitude advisory', status.heatAdvisoryActive ? 'Active' : 'None'],
  ];
  for (const [label, value] of transportRows) {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    const td = document.createElement('td');
    td.textContent = value;
    row.appendChild(th);
    row.appendChild(td);
    el.transportTbody.appendChild(row);
  }

  el.accessibilityNote.textContent = status.accessibility?.accessibleSeatingNote ?? 'No data available.';
}

async function loadBriefing() {
  if (!currentVenueId) return;
  el.briefingList.innerHTML = '';
  const loadingItem = document.createElement('li');
  loadingItem.textContent = 'Generating briefing…';
  el.briefingList.appendChild(loadingItem);

  try {
    const insight = await fetchJson(`/api/ops/${encodeURIComponent(currentVenueId)}/insight`);
    el.briefingList.innerHTML = '';
    for (const line of insight.briefing) {
      const item = document.createElement('li');
      item.textContent = line;
      el.briefingList.appendChild(item);
    }
    setModeBadge(insight.mode);
  } catch (error) {
    el.briefingList.innerHTML = '';
    const item = document.createElement('li');
    item.textContent = `Could not generate briefing: ${error.message}`;
    el.briefingList.appendChild(item);
  }
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadBriefing()]);
}

function init() {
  el.venueSelect.addEventListener('change', () => {
    currentVenueId = el.venueSelect.value;
    refreshAll();
  });
  el.refreshBtn.addEventListener('click', refreshAll);

  loadVenues()
    .then(refreshAll)
    .catch((error) => {
      el.briefingList.innerHTML = '';
      const item = document.createElement('li');
      item.textContent = `Could not load venues: ${error.message}`;
      el.briefingList.appendChild(item);
    });
}

init();
