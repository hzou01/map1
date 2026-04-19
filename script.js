let map, marker, synth;
let isAudioActive = false;

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');

    // Marker sits in a high pane so it is never blurred
    marker = L.marker([41.8245, -71.4128], { 
        draggable: true,
        pane: 'markerPane' 
    }).addTo(map);

    function syncLens() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1)+"km" : radiusMeters+"m";

        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        
        // Calculate pixel radius
        const edgeLatLng = L.latLng(markerLatLng.lat, markerLatLng.lng + 0.01);
        const edgePoint = map.latLngToContainerPoint(edgeLatLng);
        const pixelsPerDegree = Math.abs(edgePoint.x - centerPoint.x);
        const metersPerDegree = markerLatLng.distanceTo(edgeLatLng);
        const pixelRadius = (radiusMeters / metersPerDegree) * pixelsPerDegree;

        // TARGET THE TILES:
        // We find the element that holds the map tiles
        const tiles = document.querySelector('.leaflet-tile-container');
        if (tiles) {
            // This mask says: "Hide the blur in the center (transparent), show it outside (black)"
            const maskValue = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, transparent 100%, black 100%)`;
            tiles.style.webkitMaskImage = maskValue;
            tiles.style.maskImage = maskValue;
        }
    }

    slider.oninput = syncLens;
    map.on('zoom move', syncLens);
    marker.on('drag', syncLens);

    setTimeout(syncLens, 200);

    // Audio Init
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
    };
    
    // Elevation fetch on dragend
    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            if (isAudioActive && synth) synth.triggerAttackRelease(140 + ele, "1n");
        } catch(err) {}
    });
}

window.onload = init;