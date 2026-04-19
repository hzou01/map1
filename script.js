let map, marker, probeCircle, synth;
let isAudioStarted = false;

// 1. Initialize the Sound Engine (Tone.js)
const audioBtn = document.getElementById('start-btn');
audioBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await Tone.start();
        
        // Organic Sine wave for the "Botanical/Urban" probe feel
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.2, release: 1.5 }
        }).toDestination();
        
        audioBtn.innerText = "SENSORS ACTIVE";
        audioBtn.style.background = "rgba(255,255,255,0.2)";
        audioBtn.style.color = "#fff";
        isAudioStarted = true;
    }
});

// 2. Initialize the Map (Shortbread Vector Tiles)
function initMap() {
    const providence = [41.8245, -71.4128];

    // Create Leaflet map without zoom controls for a cleaner UI
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false 
    }).setView(providence, 15);

    // Load the Shortbread Vector Style (黄油酥饼)
    // Using MapLibre plugin for high-quality vector rendering
    L.maplibreGL({
        style: 'https://tiles.shortbread-tiles.org/styles/shortbread-light.json',
        // Optional: Ensure the canvas is sharp on Mac Retina displays
        pixelRatio: window.devicePixelRatio || 1
    }).addTo(map);

    // 3. Add the Draggable Physical Probe
    marker = L.marker(providence, { 
        draggable: true 
    }).addTo(map);

    // 4. Add the Liquid Glass Radius Circle
    probeCircle = L.circle(providence, {
        radius: 500,
        color: 'white',
        weight: 1,
        fillColor: 'white',
        fillOpacity: 0.08
    }).addTo(map);

    // 5. Update Coordinates in Real-Time on Drag
    marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        probeCircle.setLatLng(pos);
        document.getElementById('coords').innerText = 
            `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    });

    // 6. Data Probe: Fetch Elevation on Release (Drop)
    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        fetchElevationData(pos.lat, pos.lng);
    });
}

// 7. Topography API Logic
async function fetchElevationData(lat, lng) {
    try {
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await response.json();
        const ele = data.results[0].elevation;

        // Update the UI
        document.getElementById('ele').innerText = `${Math.round(ele)}m`;

        // Sonification: Higher elevation = Higher pitch
        if (isAudioStarted