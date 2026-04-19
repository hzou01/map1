let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Setup Map - Using standard Leaflet engine (Stable & Normal)
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false
    }).setView([41.8245, -71.4128], 16);

    // 2. THE FIX: Load standard OpenStreetMap tiles
    // This will work immediately without any API keys or 401 errors.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 3. Hardware Marker (White for contrast)
    const whiteIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-white.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41]
    });

    marker = L.marker([41.8245, -71.4128], { 
        draggable: true, 
        icon: whiteIcon 
    }).addTo(map);

    // 4. Sound Radius Circle (Controlled by the Slider)
    circle = L.circle([41.8245, -71.4128], { 
        radius: 400, 
        color: 'white', 
        weight: 1, 
        dashArray: '5, 10', // Dashed line for a technical probe look
        fillOpacity: 0.1,
        fillColor: 'white'
    }).addTo(map);

    // 5. Interaction Logic
    document.getElementById('radius-slider').oninput = (e) => {
        circle.setRadius(e.target.value);
    };

    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    marker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        fetchElevation(p.lat, p.lng);
    });

    // 6. Audio Setup
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 2 }
        }).toDestination();
        
        document.getElementById('start-btn').innerText = "SYSTEM ONLINE";
        document.getElementById('start-btn').disabled = true;
        isAudioActive = true;
    };
}

async function fetchElevation(lat, lng) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await res.json();
        const val = data.results[0].elevation;
        
        document.getElementById('ele').innerText = Math.round(val) + "m";
        
        if (isAudioActive && synth) {
            // Map elevation to frequency
            synth.triggerAttackRelease(150 + val, "2n");
        }
    } catch(err) {
        document.getElementById('ele').innerText = "DATA LAG";
    }
}

// Initial fire
window.onload = init;