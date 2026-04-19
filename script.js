let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Setup Leaflet
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false 
    }).setView([41.8245, -71.4128], 15);

    // 2. Load Shortbread Vector Preset (黄油酥饼)
    // This uses MapLibre to render the exact OSM style you want
    try {
        const glLayer = L.maplibreGL({
            style: 'https://tiles.shortbread-tiles.org/styles/shortbread-light.json',
            pane: 'tilePane'
        }).addTo(map);
        
        // Safety: Force map to recognize its size after a short delay
        setTimeout(() => map.invalidateSize(), 500);
    } catch (e) {
        console.error("Vector tiles failed, check internet connection.");
    }

    // 3. Add Hardware Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 4. Add Visual Range
    circle = L.circle([41.8245, -71.4128], { 
        radius: 500, color: 'white', weight: 1, fillOpacity: 0.1 
    }).addTo(map);

    // 5. Update UI on Drag
    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('coords').innerText = p.lat.toFixed(4) + ", " + p.lng.toFixed(4);
    });

    // 6. Data Probe on Drop
    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        fetchElevation(p.lat, p.lng);
    });

    // 7. Audio Start
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 2 }
        }).toDestination();
        
        document.getElementById('start-btn').innerText = "SENSORS ONLINE";
        document.getElementById('start-btn').style.opacity = "0.5";
        isAudioActive = true;
    };

    // 8. Slider Sync
    document.getElementById('radius').oninput = (e) => {
        circle.setRadius(e.target.value);
    };
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