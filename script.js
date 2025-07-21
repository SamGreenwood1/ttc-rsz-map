let map; // Make map globally accessible for functions
const geoJsonLayers = {}; // To store references to GeoJSON layers for filtering

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <button id="sidebar-toggle" class="small-button"></button>
    <div class="panel-content">
      <h2>Information & Filters</h2>
      <div class="section-title">Filter by Line</div>
      <div class="button-container">
        <button class="button line-filter-btn" data-line="line1">Line 1</button>
        <button class="button line-filter-btn" data-line="line2">Line 2</button>
        <button class="button line-filter-btn" data-line="line4">Line 4</button>
      </div>
      <div class="section-title">Active Reduced Speed Zones</div>
      <ul id="active-zones-list"><li>No active reduced speed zones found.</li></ul>
      <div class="settings-section">
        <h4>Settings</h4>
        <label><input type="checkbox" id="show-stations"> Show station names</label>
        <label><input type="checkbox" id="enable-dark"> Enable dark mode</label>
      </div>
      <div class="zoom-controls">
        <button id="zoom-in" class="button">+</button>
        <button id="zoom-out" class="button">−</button>
      </div>
    </div>
  `;
}

function renderLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = `
    <button id="legend-toggle" class="small-button"></button>
    <div class="panel-content">
      <h3 id="legend-header">Legend</h3>
      <ul id="legend-list">
        <li><span class="legend-swatch swatch-line1"></span>Line 1 (Regular)</li>
        <li><span class="legend-swatch swatch-line1-rsz"></span>Line 1 (Reduced Speed Zone)</li>
        <li><span class="legend-swatch swatch-line2"></span>Line 2 (Regular)</li>
        <li><span class="legend-swatch swatch-line2-rsz"></span>Line 2 (Reduced Speed Zone)</li>
        <li><span class="legend-swatch swatch-line4"></span>Line 4 (Regular)</li>
        <li><span class="legend-swatch swatch-line4-rsz"></span>Line 4 (Reduced Speed Zone)</li>
      </ul>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', function() {
  renderSidebar();
  renderLegend();
  // Initialize the map with zoomControl: false
  map = L.map("map", { zoomControl: false }).setView([43.665, -79.385], 12); // Centered on Toronto

  // Lock map to Toronto city bounds (tight bounding box)
  var torontoCityBounds = L.latLngBounds(
    [43.581, -79.639], // Southwest (approximate city limit)
    [43.855, -79.115]  // Northeast (approximate city limit)
  );
  map.setMaxBounds(torontoCityBounds);
  map.options.minZoom = 11;
  map.options.maxZoom = 19;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Custom zoom controls in sidebar
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  if (zoomInBtn && zoomOutBtn) {
    zoomInBtn.addEventListener('click', function() {
      map.zoomIn();
    });
    zoomOutBtn.addEventListener('click', function() {
      map.zoomOut();
    });
  }

  // Clear the active zones list before drawing
  const activeZonesList = document.getElementById("active-zones-list");
  if (activeZonesList) activeZonesList.innerHTML = "";

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
    if (activeZonesList && !activeZonesList.hasChildNodes()) {
      activeZonesList.innerHTML = "<li>No active reduced speed zones found.</li>";
    }
  }).catch(err => {
    showError("There was a problem loading subway line data. Please check the TTC's list for the latest information.");
  });

  // Floating/foldable panel logic
  function setupFloatingPanels() {
    function foldPanel(panelId, toggleId, direction, openTitle, closedTitle) {
      const panel = document.getElementById(panelId);
      const toggle = document.getElementById(toggleId);
      const content = panel.querySelector('.panel-content');
      function setTooltipAndArrow() {
        if (panel.classList.contains('folded')) {
          toggle.title = openTitle;
          toggle.innerHTML = direction === 'left' ? '&raquo;' : '&laquo;';
        } else {
          toggle.title = closedTitle;
          toggle.innerHTML = direction === 'left' ? '&laquo;' : '&raquo;';
        }
      }
      toggle.addEventListener('click', function() {
        if (panel.classList.contains('folded')) {
          panel.classList.remove('folded');
          content.style.display = '';
        } else {
          panel.classList.add('folded');
          content.style.display = 'none';
        }
        setTooltipAndArrow();
      });
      setTooltipAndArrow();
    }
    foldPanel('sidebar', 'sidebar-toggle', 'left', 'Open sidebar', 'Fold sidebar');
    foldPanel('legend', 'legend-toggle', 'right', 'Open legend', 'Fold legend');
  }
  setupFloatingPanels();

  // Feature detection for CSS if() support
  (function() {
    try {
      const test = document.createElement('div');
      test.style.width = "if(media(max-width: 600px): 100vw; else: 300px);";
      if (test.style.width.includes('if(')) {
        document.body.classList.add('no-css-if');
      }
    } catch (e) {
      document.body.classList.add('no-css-if');
    }
  })();

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
  setupLineFilterButtons();

  // Show station names toggle
  document.getElementById('show-stations').addEventListener('change', function(e) {
    if (e.target.checked) {
      // Code to show station names on the map
    } else {
      // Code to hide station names
    }
  });

  // Enable dark mode toggle
  document.getElementById('enable-dark').addEventListener('change', function(e) {
    if (e.target.checked) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });
});

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
  if (!list) return;
  const listItem = document.createElement("li");
  listItem.innerHTML = `<strong>${feature.properties.line}</strong>
                          <span>${feature.properties.start_station} &harr; ${feature.properties.end_station}</span>`;
  listItem.onclick = () => {
    map.fitBounds(layer.getBounds().pad(0.2)); // Zoom to the zone
    layer.openPopup();
  };
  list.appendChild(listItem);
}

function showError(message) {
  const mapDiv = document.getElementById("map");
  mapDiv.innerHTML = `<div style='padding:2rem;text-align:center;color:#b00;font-weight:bold;font-size:1.2rem;'>${message}<br><br><a href='https://www.ttc.ca/service-alerts' target='_blank' style='color:#da251d;text-decoration:underline;'>Check the official TTC Service Alerts</a></div>`;
} 