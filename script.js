let map, marker, synth, isAudioActive = false;

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function updateProbe() {
        const radius = document.getElementById('radius-slider').value;
        const pos = map.latLngToContainerPoint(marker.getLatLng());
        
        // Target the tile container to move the "B&W" mask
        const tiles = document.querySelector('.leaflet-tile-container');
        if (tiles) {
            const mask = `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, transparent 100%, black 100%)`;
            tiles.style.webkitMaskImage = mask;
            tiles.style.maskImage = mask;
        }
    }

    marker.on('drag', () => {
        updateProbe();
        const p = marker.getLatLng();
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    document.getElementById('radius-slider').oninput = updateProbe;
    map.on('zoom move', updateProbe);

    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth().toDestination();
        isAudioActive = true;
        document.getElementById('start-btn').innerText = "ONLINE";
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
        const data = await res.json();
        const ele = Math.round(data.results[0].elevation);
        document.getElementById('ele').innerText = ele + "m";
        if (isAudioActive) synth.triggerAttackRelease(150 + ele, "4n");
    });

    // Run once at start
    setTimeout(updateProbe, 100);
}

window.onload = init;