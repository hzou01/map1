let map, marker, synth, isAudioActive = false;

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    
    // Standard tiles - the CSS handles making them B&W
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Hardware Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function updateMask() {
        const radius = document.getElementById('radius-slider').value;
        const pos = map.latLngToContainerPoint(marker.getLatLng());
        
        // Find the tile layer and apply the radial "hole"
        const tileContainer = document.querySelector('.leaflet-tile-container');
        if (tileContainer) {
            // "transparent" at the center means NO grayscale filter (Color)
            // "black" at the edge means YES grayscale filter (B&W)
            const maskValue = `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, transparent 100%, black 100%)`;
            tileContainer.style.webkitMaskImage = maskValue;
            tileContainer.style.maskImage = maskValue;
        }
    }

    // Sync Mask to Marker & Zoom
    marker.on('drag', updateMask);
    map.on('zoom move', updateMask);
    document.getElementById('radius-slider').oninput = updateMask;

    // Audio Initialization
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, release: 1 }
        }).toDestination();
        document.getElementById('start-btn').innerText = "SENSORS ONLINE";
        isAudioActive = true;
    };

    marker.on('dragend', async () => {
        const p = marker.getLatLng();
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
        
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            document.getElementById('ele').innerText = ele + "m";
            if (isAudioActive) synth.triggerAttackRelease(150 + ele, "4n");
        } catch(e) {}
    });

    // Initial render call
    setTimeout(updateMask, 500);
}

window.onload = init;