let mapBase, mapColor, marker, circle, synth;
let isAudioActive = false;

function init() {
    // 1. Initialize both maps in sync
    const mapOptions = { zoomControl: false, attributionControl: false };
    mapBase = L.map('map-bw', mapOptions).setView([41.8245, -71.4128], 16);
    mapColor = L.map('map-color', mapOptions).setView([41.8245, -71.4128], 16);

    // Add identical tiles to both
    const tilesUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tilesUrl).addTo(mapBase);
    L.tileLayer(tilesUrl).addTo(mapColor);

    // Sync views
    mapBase.on('move', () => {
        mapColor.setView(mapBase.getCenter(), mapBase.getZoom(), { animate: false });
        updateLens();
    });

    // 2. Hardware Probe Marker
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(mapBase);

    // Visual ring for the probe
    circle = L.circle([41.8245, -71.4128], {
        radius: 100, // Placeholder, will be updated by pixel math
        color: 'white',
        weight: 1,
        dashArray: '5, 5',
        fillOpacity: 0
    }).addTo(mapBase);

    // 3. The Lens Function (Pixel-based clipping)
    function updateLens() {
        const radiusPx = document.getElementById('radius-slider').value;
        const markerPos = mapBase.latLngToContainerPoint(marker.getLatLng());
        
        // Apply clip-path to the color map
        const colorMapEl = document.getElementById('map-color');
        colorMapEl.style.clipPath = `circle(${radiusPx}px at ${markerPos.x}px ${markerPos.y}px)`;
        
        // Match the visual ring to the lens size
        // Note: converting pixels to meters for the Leaflet circle
        const center = marker.getLatLng();
        const edgePoint = mapBase.containerPointToLatLng([markerPos.x + parseInt(radiusPx), markerPos.y]);
        circle.setLatLng(center);
        circle.setRadius(center.distanceTo(edgePoint));
    }

    // Interaction Listeners
    marker.on('drag', () => {
        updateLens();
        const p = marker.getLatLng();
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    document.getElementById('radius-slider').oninput = updateLens;
    mapBase.on('zoom', updateLens);

    // 4. Audio Engine
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        document.getElementById('start-btn').disabled = true;
        isAudioActive = true;
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            document.getElementById('ele').innerText = ele + "m";
            if (isAudioActive) synth.triggerAttackRelease(150 + ele, "2n");
        } catch(err) { console.warn("Elevation data unavailable"); }
    });

    // Initial positioning
    setTimeout(updateLens, 500);
}

window.onload = init;