let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Setup Leaflet - centered on Providence
    // We set 'fadeAnimation: false' to prevent standard tiles from ghosting in
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false
    }).setView([41.8245, -71.4128], 15);

    // 2. THE PURGE: Ensure NO L.tileLayer exists here. 
    // We only use the MapLibreGL layer for the Shortbread Preset.
    
    const shortbreadLayer = L.maplibreGL({
        style: 'https://tiles.shortbread-tiles.org/styles/shortbread-light.json',
        pane: 'tilePane',
        // This ensures the vector tiles fill the screen correctly on Mac
        antialias: true 
    }).addTo(map);

    // 3. Hardware Marker & Circle
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    circle = L.circle([41.8245, -71.4128], { 
        radius: 500, 
        color: 'white', 
        weight: 1, 
        fillOpacity: 0.1 
    }).addTo(map);

    // 4. Force a refresh to kick the vector engine into gear
    shortbreadLayer.getMapboxMap().on('load', () => {
        console.log("Shortbread Preset Loaded Successfully");
        map.invalidateSize();
    });

    // --- Rest of your UI/Audio logic remains the same ---
    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('coords').innerText = p.lat.toFixed(4) + ", " + p.lng.toFixed(4);
    });

    marker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        fetchElevation(p.lat, p.lng);
    });
}

async function fetchElevation(lat, lng) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await res.json();
        const val = data.results[0].elevation;
        
        document.getElementById('ele').innerText = Math.round(val) + "m";
        
        if (isAudioActive && synth) {
            // Mapping elevation to a clean frequency
            synth.triggerAttackRelease(180 + val, "2n");
        }
    } catch(err) {
        document.getElementById('ele').innerText = "DATA ERROR";
    }
}

// Fire system
window.onload = init;