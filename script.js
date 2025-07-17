let map; // Make map globally accessible for functions
const geoJsonLayers = {}; // To store references to GeoJSON layers for filtering

// Sidebar toggle logic
document.addEventListener("DOMContentLoaded", function () {
  const aside = document.querySelector("aside");
  const toggleBtn = document.getElementById("sidebarToggle");
  let collapsed = false;
  toggleBtn.addEventListener("click", function () {
    collapsed = !collapsed;
    aside.classList.toggle("aside-collapsed", collapsed);
    toggleBtn.innerText = collapsed ? "»" : "«";
  });
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

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Clear the active zones list before drawing
  document.getElementById("active-zones-list").innerHTML = "";

  // Load regular lines and render RSZs from API endpoints only
  Promise.all([
    fetch("/api/lines/line1").then(r => r.json()),
    fetch("/api/lines/line2").then(r => r.json()),
    fetch("/api/lines/line4").then(r => r.json())
  ]).then(([line1, line2, line4]) => {
    drawLineGeoJson(line1, "Line 1");
    drawLineGeoJson(line2, "Line 2");
    drawLineGeoJson(line4, "Line 4");
    // If no RSZs found, show a message
    if (!document.getElementById("active-zones-list").hasChildNodes()) {
      document.getElementById("active-zones-list").innerHTML = "<li>No active reduced speed zones found.</li>";
    }
  }).catch(err => {
    showError("There was a problem loading subway line data from the TTC API. Please check the TTC's list for the latest information.");
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
  L.geoJSON(geojson, {
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

// Basic Filter Logic (Placeholder - needs more work for actual filtering)
// This is a very simplified example. Real filtering would involve
// removing/adding layers or changing their styles.
document
  .querySelectorAll('.filter-group input[type="checkbox"]')
  .forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      // For now, just log. Actual filtering is more complex.
      console.log(
        `Filter for ${checkbox.name} changed to ${checkbox.checked}`
      );
      // To implement actual filtering, you'd need to:
      // 1. Iterate through your geoJsonLayers.speedZones.getLayers()
      // 2. Check feature.properties.line against the checkbox states
      // 3. Either remove/add the layer from the map, or change its style to hide/show it.
      // This can get complex if you have many layers or complex filter criteria.
      // A simpler approach for this prototype might be to re-fetch/re-render
      // based on filter criteria if your dataset is small.
      alert(
        "Filter functionality is a placeholder in this prototype."
      );
    });
  }); 