let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Map & Standard Layers
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. Marker & Initial Circle
    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);
    
    // We initialize the circle with the slider's actual current value
    circle = L.circle([41.8245, -71.4128], {
        radius: slider.value, 
        color: '#000',
        weight: 1,
        dashArray: '5, 10',
        fillOpacity: 0.05,
        fillColor: '#000'
    }).addTo(map);

    // 3. The Sync Function
    function syncProbeRadius(value) {
        const val = parseInt(value);
        circle.setRadius(val);
        
        // Dynamic unit switching
        if (val >= 1000) {
            display.innerText = (val / 1000).toFixed(1) + "km";
        } else {
            display.innerText = val + "m";
        }
    }

    // 4. Listeners
    slider.oninput = (e) => syncProbeRadius(e.target.value);

    // 5. INITIAL INJECTION: This makes the HTML change immediately
    syncProbeRadius(slider.value);

    // Marker interactions
    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    marker.on('dragend', (e) => fetchElevation(e.target.getLatLng()));

    // Audio button logic
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
        document.getElementById('ele').innerText = ele + "m";
        if (isAudioActive && synth) synth.triggerAttackRelease(150 + ele, "1n");
    } catch(e) { document.getElementById('ele').innerText = "OFFLINE"; }
}

window.onload = init;