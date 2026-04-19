let map, marker, probeCircle;
let synth, lfo, filter;
let isAudioStarted = false;

// 1. Initialize Sound Engine
const audioBtn = document.getElementById('audio-btn');
audioBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await Tone.start();
        
        // A soft, "atmospheric" synth setup
        filter = new Tone.Filter(800, "lowpass").toDestination();
        lfo = new Tone.LFO("4n", 400, 1200).connect(filter.frequency).start();
        
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 1 }
        }).connect(filter);
        
        synth.volume.value = -12;
        
        isAudioStarted = true;
        audioBtn.innerText = "PROBE ACTIVE";
        audioBtn.style.background = "rgba(255,255,255,0.2)";
        audioBtn.style.color = "#fff";
    }
});

// 2. Initialize Map (Leaflet - Open Source)
function initMap() {
    // Center on Providence
    const startPos = [41.8245, -71.4128];
    
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(startPos, 15);

    // Using a "CartoDB Dark Matter" tile for a sleek industrial look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Draggable Marker
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    // Visual Radius (Liquid Glass style)
    probeCircle = L.circle(startPos, {
        radius: 500,
        color: 'white',
        weight: 1,
        fillColor: 'white',
        fillOpacity: 0.05
    }).addTo(map);

    // Sync circle and UI with marker movement
    marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        probeCircle.setLatLng(pos);
        document.getElementById('coords').innerText = 
            `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    });

    // Run data probe when user lets go
    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        fetchElevation(pos.lat, pos.lng);
    });
}

// 3. Radius Slider Logic
document.getElementById('radius-slider').addEventListener('input', (e) => {
    const r = parseInt(e.target.value);
    if (probeCircle) probeCircle.setRadius(r);
});

// 4. Free Topography API (Open-Elevation)
async function fetchElevation(lat, lng) {
    try {
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await response.json();
        const ele = data.results[0].elevation;

        document.getElementById('ele').innerText = `${Math.round(ele)} m`;

        // Update Sound based on Topography
        if (isAudioStarted) {
            // Map elevation to frequency: 100m -> C3, 1000m -> C5
            const freq = Tone.Midi(48 + (ele / 10)).toFrequency();
            synth.triggerAttackRelease(freq, "2n");
            
            // Adjust filter based on height (higher = clearer)
            filter.frequency.rampTo(Math.max(200, ele * 5), 0.5);
        }
    } catch (error) {
        console.error("Elevation API unavailable:", error);
    }
}

// Start Map
initMap();