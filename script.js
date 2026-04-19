let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Initialize Map
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([41.8245, -71.4128], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. Hardware Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 3. Sound Circle
    circle = L.circle([41.8245, -71.4128], {
        radius: 400,
        color: '#000',
        weight: 1,
        dashArray: '5, 10',
        fillOpacity: 0.05,
        fillColor: '#000'
    }).addTo(map);

    // 4. Slider & Display Logic
    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');

    slider.oninput = (e) => {
        const val = e.target.value;
        circle.setRadius(val);
        
        // Dynamic Formatting (m vs km)
        if (val >= 1000) {
            display.innerText = (val / 1000).toFixed(1) + "km";
        } else {
            display.innerText = val + "m";
        }
    };

    // 5. Interaction Listeners
    marker.on('drag', (e) => {
        const p = e.target.getLatLng();
        circle.setLatLng(p);
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    marker.on('dragend', (e) => {
        fetchElevation(e.target.getLatLng());
    });

    // 6. Audio Activation
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.2, release: 2 }
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
            // Mapping elevation to frequency (Higher = Tighter sound)
            synth.triggerAttackRelease(140 + ele, "1n");
        }
    } catch(err) {
        document.getElementById('ele').innerText = "SYNC...";
    }
}

window.onload = init;