let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Initialize Map (Normal, Colorful OSM)
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([41.8245, -71.4128], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. Standard Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 3. Sound Circle (Controlled by Slider)
    circle = L.circle([41.8245, -71.4128], {
        radius: 400,
        color: '#000',
        weight: 1.5,
        dashArray: '5, 10',
        fillOpacity: 0.05,
        fillColor: '#000'
    }).addTo(map);

    // 4. Update Circle & UI on Slider Input
    document.getElementById('radius-slider').oninput = (e) => {
        circle.setRadius(e.target.value);
    };

    // 5. Update UI on Marker Drag
    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    // 6. Audio Trigger on Drag End
    marker.on('dragend', (e) => {
        fetchElevation(e.target.getLatLng());
    });

    // 7. Initialize Audio Engine
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 1 }
        }).toDestination();
        
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        document.getElementById('start-btn').disabled = true;
        isAudioActive = true;
    };
}

async function fetchElevation(pos) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${pos.lat},${pos.lng}`);
        const data = await res.json();
        const ele = Math.round(data.results[0].elevation);
        
        document.getElementById('ele').innerText = ele + "m";
        
        if (isAudioActive && synth) {
            // Map elevation to frequency
            synth.triggerAttackRelease(150 + ele, "2n");
        }
    } catch(err) {
        document.getElementById('ele').innerText = "ERROR";
    }
}

window.onload = init;