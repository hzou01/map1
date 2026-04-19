let map, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Initialize Map (Normal OSM tiles)
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([41.8245, -71.4128], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. White Hardware Marker
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

    // 3. Sensory Region Circle
    circle = L.circle([41.8245, -71.4128], {
        radius: 400,
        color: '#fff',
        weight: 1,
        dashArray: '5, 10',
        fillOpacity: 0.1,
        fillColor: '#fff'
    }).addTo(map);

    // 4. Slider Connection
    document.getElementById('radius-slider').oninput = (e) => {
        circle.setRadius(e.target.value);
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

    // 6. Audio Start
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

async function fetchElevation(pos) {
    try {
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${pos.lat},${pos.lng}`);
        const data = await res.json();
        const ele = Math.round(data.results[0].elevation);
        
        document.getElementById('ele').innerText = ele + "m";
        
        if (isAudioActive && synth) {
            // Mapping elevation to frequency (Lower elevation = Deeper drone)
            synth.triggerAttackRelease(150 + ele, "2n");
        }
    } catch(err) {
        document.getElementById('ele').innerText = "ERROR";
    }
}

window.onload = init;