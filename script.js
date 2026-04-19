let map, marker, probeCircle, synth;
let isStarted = false;

function init() {
    // 1. Initialize Map
    const startPos = [41.8245, -71.4128]; // Providence
    map = L.map('map', { zoomControl: false }).setView(startPos, 15);

    // 2. Load "Voyager" Tiles (Best for color isolation)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png')
    .addTo(map);

    // 3. The Draggable Probe
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    // 4. The Visual Radius (Liquid Glass style)
    probeCircle = L.circle(startPos, {
        radius: 500,
        color: 'white',
        weight: 1,
        fillColor: 'white',
        fillOpacity: 0.05
    }).addTo(map);

    // 5. Interaction: Sync UI with Marker Dragging
    marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        probeCircle.setLatLng(pos);
        document.getElementById('coords').innerText = 
            `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    });

    // 6. Data Probe: Fetch Elevation on Release
    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        fetchElevation(pos.lat, pos.lng);
    });

    // 7. Audio Button Listener
    const btn = document.getElementById('audio-btn');
    btn.onclick = async () => {
        if (!isStarted) {
            await Tone.start();
            // Clean, organic Sine wave for a "Botanical" feel
            synth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 0.2, release: 2 }
            }).toDestination();
            
            btn.innerText = "SENSOR ACTIVE";
            btn.style.background = "rgba(255,255,255,0.2)";
            btn.style.color = "#fff";
            isStarted = true;
        }
    };
}

// 8. The Topography Data Fetch
async function fetchElevation(lat, lng) {
    try {
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await response.json();
        const ele = data.results[0].elevation;

        document.getElementById('ele').innerText = `${Math.round(ele)}m`;

        // Map height to pitch: Higher = more "ethereal" high notes
        if (isStarted && synth) {
            let freq = 180 + (ele * 0.4); 
            synth.triggerAttackRelease(freq, "2n");
        }
    } catch (err) {
        document.getElementById('ele').innerText = "API BUSY";
    }
}

// 9. Slider Link
document.getElementById('radius-slider').oninput = (e) => {
    if (probeCircle) probeCircle.setRadius(e.target.value);
};

// Fire it up
window.onload = init;