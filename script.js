let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Initialize Map
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. DOM Elements
    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');

    // 3. Setup Marker and Circle
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);
    
    circle = L.circle([41.8245, -71.4128], {
        radius: slider.value,
        color: '#000',
        weight: 1,
        dashArray: '5, 10',
        fillOpacity: 0.05,
        fillColor: '#000'
    }).addTo(map);

    // 4. THE SYNC LOGIC
    function syncProbe() {
        const val = parseInt(slider.value);
        
        // Update the circle on the map
        circle.setRadius(val);
        
        // Update the text display
        if (val >= 1000) {
            display.innerText = (val / 1000).toFixed(1) + "km";
        } else {
            display.innerText = val + "m";
        }
    }

    // Bind the listener for live dragging
    slider.oninput = syncProbe;

    // FORCE INITIAL SYNC (This fixes the "400m stays the same" bug)
    syncProbe();

    // 5. Interaction Listeners
    marker.on('drag', (e) => {
        circle.setLatLng(e.target.getLatLng());
    });

    marker.on('dragend', (e) => {
        fetchElevation(e.target.getLatLng());
    });

    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
    };
}

async function fetchElevation(pos) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${pos.lat},${pos.lng}`);
        const data = await res.json();
        const ele = Math.round(data.results[0].elevation);
        if (isAudioActive && synth) synth.triggerAttackRelease(150 + ele, "1n");
    } catch(e) { console.warn("Elevation Sync Error"); }
}

window.onload = init;