let map, marker, probeCircle;
let synth;
let isAudioStarted = false;

// 1. Audio Setup
const audioBtn = document.getElementById('audio-btn');
audioBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await Tone.start();
        // Simple Sine Synth
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 1 }
        }).toDestination();
        
        isAudioStarted = true;
        audioBtn.innerText = "SENSORS ONLINE";
        audioBtn.style.background = "rgba(255,255,255,0.2)";
    }
});

// 2. Map Initialization
function initMap() {
    // Check if the map div exists
    if (!document.getElementById('map')) return;

    // Initialize Map (Providence)
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false 
    }).setView([41.8245, -71.4128], 14);

    // Load Dark Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Add Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // Add Circle
    probeCircle = L.circle([41.8245, -71.4128], {
        radius: 500,
        color: 'white',
        weight: 1,
        fillOpacity: 0.1
    }).addTo(map);

    // CRITICAL: Dragging updates numbers
    marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        probeCircle.setLatLng(pos);
        
        // Update the UI text immediately
        document.getElementById('coords').innerText = 
            `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    });

    // Trigger data fetch when dropped
    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        updateProbeData(pos.lat, pos.lng);
    });
}

// 3. Data Fetching
async function updateProbeData(lat, lng) {
    try {
        // Fetch real topography (2026 Free API)
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await res.json();
        const ele = data.results[0].elevation;

        document.getElementById('ele').innerText = Math.round(ele) + "m";

        if (isAudioStarted && synth) {
            let freq = 150 + (ele * 0.5); // Elevation maps to pitch
            synth.triggerAttackRelease(freq, "4n");
        }
    } catch (err) {
        document.getElementById('ele').innerText = "Data Error";
    }
}

// Slider Radius Sync
document.getElementById('radius-slider').addEventListener('input', (e) => {
    if (probeCircle) probeCircle.setRadius(parseInt(e.target.value));
});

// Fire the map
window.onload = initMap;