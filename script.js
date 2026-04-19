let map, marker, probeCircle;
let synth;
let isAudioStarted = false;

// 1. Initialize Sound (Tone.js)
const audioBtn = document.getElementById('audio-btn');
audioBtn.addEventListener('click', async () => {
    if (!isAudioStarted) {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 2 }
        }).toDestination();
        
        isAudioStarted = true;
        audioBtn.innerText = "PROBE ACTIVE";
        audioBtn.style.background = "rgba(255,255,255,0.2)";
        audioBtn.style.color = "#fff";
    }
});

// 2. Initialize Leaflet Map (NO GOOGLE REQUIRED)
function initMap() {
    // Starting coordinates (Providence)
    const startPos = [41.8245, -71.4128];

    // Create the map object
    map = L.map('map', { zoomControl: false }).setView(startPos, 14);

    // Use a FREE Open-Source map style (CartoDB Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Add the Draggable Pin
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    // Add the "Liquid Glass" Radius
    probeCircle = L.circle(startPos, {
        radius: 500,
        color: 'white',
        weight: 1,
        fillOpacity: 0.1
    }).addTo(map);

    // Update UI while dragging
    marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        probeCircle.setLatLng(pos);
        document.getElementById('coords').innerText = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    });

    // Probe data when dragging stops
    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        getElevation(pos.lat, pos.lng);
    });
}

// 3. Get Topography Data
async function getElevation(lat, lng) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await res.json();
        const ele = data.results[0].elevation;

        document.getElementById('ele').innerText = Math.round(ele) + "m";

        if (isAudioStarted) {
            // Map height to pitch (e.g., higher ground = higher note)
            let frequency = 200 + (ele * 0.5); 
            synth.triggerAttackRelease(frequency, "2n");
        }
    } catch (err) {
        console.log("Elevation service timeout, still works without it!");
    }
}

initMap();