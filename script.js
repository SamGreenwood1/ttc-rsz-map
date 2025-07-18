let map; // Make map globally accessible for functions
const geoJsonLayers = {}; // To store references to GeoJSON layers for filtering
let stationLayer = null;
let stationsVisible = false;

// Sidebar toggle logic
document.addEventListener("DOMContentLoaded", function () {
  const aside = document.querySelector("aside");
  const toggleBtn = document.getElementById("sidebarToggle");
  let collapsed = localStorage.getItem("sidebarCollapsed") === "true";

  function updateSidebarState() {
    aside.classList.toggle("aside-collapsed", collapsed);
    toggleBtn.innerText = "☰";
    localStorage.setItem("sidebarCollapsed", collapsed);
  }

  toggleBtn.addEventListener("click", function () {
    collapsed = !collapsed;
    updateSidebarState();
  });

  // Initial state
  updateSidebarState();
});

function showError(message) {
  const mapDiv = document.getElementById("map");
  mapDiv.innerHTML = `<div style='padding:2rem;text-align:center;color:#b00;font-weight:bold;font-size:1.2rem;'>${message}<br><br><a href='https://www.ttc.ca/service-alerts' target='_blank' style='color:#da251d;text-decoration:underline;'>Check the official TTC Service Alerts</a></div>`;
}

// Initialize the map
function initMap() {
  map = L.map("map").setView([43.665, -79.385], 12); // Centered on Toronto

  // Lock map to Toronto city bounds (tight bounding box)
  var torontoCityBounds = L.latLngBounds(
    [43.581, -79.639], // Southwest (approximate city limit)
    [43.855, -79.115]  // Northeast (approximate city limit)
  );
  map.setMaxBounds(torontoCityBounds);
  map.options.minZoom = 11;
  map.options.maxZoom = 19;

  // Use CartoDB Positron as the base map for a cleaner look
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Clear the active zones list before drawing
  document.getElementById("active-zones-list").innerHTML = "";

  // Load regular lines and render RSZs from static files only
  Promise.all([
    fetch("lines/line1.json").then(r => r.json()),
    fetch("lines/line2.json").then(r => r.json()),
    fetch("lines/line4.json").then(r => r.json())
  ]).then(([line1, line2, line4]) => {
    drawLineGeoJson(line1, "Line 1");
    drawLineGeoJson(line2, "Line 2");
    drawLineGeoJson(line4, "Line 4");
    // If no RSZs found, show a message
    if (!document.getElementById("active-zones-list").hasChildNodes()) {
      document.getElementById("active-zones-list").innerHTML = "<li>No active reduced speed zones found.</li>";
    }
  }).catch(err => {
    showError("There was a problem loading the subway map data. Please check your local data or try reloading the page.");
  });

  // --- GTFS-realtime live subway vehicle positions (Transit.land proxy) ---
  const gtfsStatus = document.getElementById('gtfs-status-indicator');
  if (gtfsStatus) {
    gtfsStatus.textContent = 'Checking...';
    gtfsStatus.style.color = '#888';
  }
  fetch('https://transit.land/api/v2/rest/gtfs-rt/vehicle-positions?operator_onestop_id=o-dpz8-ttc')
    .then(r => r.json())
    .then(data => {
      if (!data || !data.entity) {
        if (gtfsStatus) {
          gtfsStatus.textContent = 'Failed';
          gtfsStatus.style.color = '#b00'; // red
        }
        return;
      }
      if (gtfsStatus) {
        gtfsStatus.textContent = 'Connected';
        gtfsStatus.style.color = '#00923F'; // green
      }
      data.entity.forEach(entity => {
        if (!entity.vehicle || !entity.vehicle.position) return;
        const routeId = entity.vehicle.trip && entity.vehicle.trip.route_id;
        if (routeId && !['74515','74516','74518'].includes(routeId)) return; // Line 1,2,4 GTFS IDs
        const { latitude, longitude } = entity.vehicle.position;
        if (latitude && longitude) {
          L.circleMarker([latitude, longitude], {
            radius: 7,
            color: '#da251d',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 2
          })
          .bindPopup(`<strong>Live TTC Subway Train</strong><br>Route: ${routeId || 'Unknown'}`)
          .addTo(map);
        }
      });
    })
    .catch(err => {
      if (gtfsStatus) {
        gtfsStatus.textContent = 'Connection Error';
        gtfsStatus.style.color = '#b00'; // red
      }
      showError("There was a problem loading live subway train data (GTFS-realtime). Service status may be unavailable.");
    });

  // --- TTC Subway Stations from GTFS (Transit.land) ---
  fetch('https://transit.land/api/v1/stops.geojson?served_by=o-dpz8-ttc&served_by_vehicle_types=1')
    .then(r => r.json())
    .then(data => {
      if (!data.features) return;
      stationLayer = L.layerGroup();
      data.features.forEach(f => {
        if (!f.geometry || !f.geometry.coordinates) return;
        const coords = f.geometry.coordinates;
        // GeoJSON is [lng, lat]
        const lat = coords[1], lng = coords[0];
        const marker = L.circleMarker([lat, lng], {
          radius: 6,
          color: '#0055cc',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2
        })
        .bindPopup(`<strong>${f.properties.name}</strong><br>Station ID: ${f.properties.onestop_id}`);
        stationLayer.addLayer(marker);
      });
      // Do not add to map by default
    });

  // --- Station toggle button logic ---
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('station-toggle-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (!stationLayer) return;
      stationsVisible = !stationsVisible;
      if (stationsVisible) {
        stationLayer.addTo(map);
        btn.textContent = 'Hide Subway Stations';
      } else {
        map.removeLayer(stationLayer);
        btn.textContent = 'Show Subway Stations';
      }
    });
    btn.textContent = 'Show Subway Stations';
  });
}

// Draw regular TTC lines from GeoJSON
function drawLineGeoJson(geojson, lineKey) {
  // Official TTC line colors
  const lineColors = {
    "Line 1": "#F8C300",
    "Line 2": "#00923F",
    "Line 4": "#A21A68"
  };
  // Lighter/transparent version for regular service
  const lineColorsRegular = {
    "Line 1": "rgba(248,195,0,0.4)",
    "Line 2": "rgba(0,146,63,0.4)",
    "Line 4": "rgba(162,26,104,0.4)"
  };
  const layer = L.geoJSON(geojson, {
    filter: f => f.properties.type === "tracks" || f.properties.type === "rsz",
    style: f => {
      if (f.properties.type === "rsz") {
        return {
          color: lineColors[lineKey] || "#888",
          weight: 7,
          opacity: 0.9
        };
      } else {
        return {
          color: lineColorsRegular[lineKey] || "#888",
          weight: 5,
          opacity: 0.7
        };
      }
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties.type === "rsz") {
        // Add popup for RSZ
        let popupContent = `<h3>Reduced Speed Zone</h3>
          <strong>Line:</strong> ${lineKey}<br>
          <strong>Direction:</strong> ${feature.properties.direction || "N/A"}<br>
          <strong>Between:</strong> ${feature.properties.start_station} and ${feature.properties.end_station}<br>
          <strong>Reduced Speed:</strong> ${feature.properties.speed_kph} km/h<br>
          <strong>Reason:</strong> ${feature.properties.reason}`;
        layer.bindPopup(popupContent);
        // Add to active zones list
        addZoneToList({
          properties: {
            line: lineKey,
            direction: feature.properties.direction,
            start_station: feature.properties.start_station,
            end_station: feature.properties.end_station,
            speed_kph: feature.properties.speed_kph,
            reason: feature.properties.reason
          }
        }, layer);
      }
    }
  }).addTo(map);
  geoJsonLayers[lineKey.toLowerCase().replace(' ', '')] = layer;
}

// Add a zone to the sidebar list
function addZoneToList(feature, layer) {
  const list = document.getElementById("active-zones-list");
  const listItem = document.createElement("li");
  listItem.innerHTML = `<strong>${feature.properties.line}</strong>
                          <span>${feature.properties.start_station} &harr; ${feature.properties.end_station}</span>`;
  listItem.onclick = () => {
    map.fitBounds(layer.getBounds().pad(0.2)); // Zoom to the zone
    layer.openPopup();
  };
  list.appendChild(listItem);
}

// Initialize the map when the DOM is ready
document.addEventListener("DOMContentLoaded", initMap);

// Line filter button logic (multi-select)
function setupLineFilterButtons() {
  const btns = document.querySelectorAll('.line-filter-btn');
  // Track which lines are visible
  const visibleLines = {
    line1: true,
    line2: true,
    line4: true
  };

  function updateMapVisibility() {
    // Hide/show layers based on visibleLines
    Object.keys(visibleLines).forEach(lineKey => {
      const layer = geoJsonLayers[lineKey];
      if (layer) {
        if (visibleLines[lineKey]) {
          if (!map.hasLayer(layer)) map.addLayer(layer);
        } else {
          if (map.hasLayer(layer)) map.removeLayer(layer);
        }
      }
    });
  }

  btns.forEach(btn => {
    const line = btn.dataset.line;
    // Set initial state
    btn.classList.add('active');
    btn.addEventListener('click', () => {
      visibleLines[line] = !visibleLines[line];
      btn.classList.toggle('active', visibleLines[line]);
      updateMapVisibility();
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setupLineFilterButtons();
}); 