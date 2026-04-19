let mapBase, mapColor, marker, circle, synth;
let isAudioActive = false;

function init() {
    // Standard Leaflet options
    const mapOptions = { zoomControl: false, attributionControl: false };
    
    // Initialize both maps
    mapBase = L.map('map-bw', mapOptions).setView([41.8245, -71.4128], 16);
    mapColor = L.map('map-color', mapOptions).setView([41.8245, -71.4128], 16);

    // Use a very reliable Tile source
    const tiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tiles).addTo(mapBase);
    L.tileLayer(tiles).addTo(mapColor);

    // Sync the color map to the base map
    mapBase.on('move', () => {
        mapColor.setView(mapBase.getCenter(), mapBase.getZoom(), { animate: false });
        updateLens();
    });

    // Add the interactive marker to the Base map
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(mapBase);

    // Visual ring for the probe
    circle = L.circle([41.8245, -71.4128], {
        radius: 100, color: 'black', weight: 1, dashArray: '5, 5', fillOpacity: 0
    }).addTo(mapBase);

    function updateLens() {
        const radiusPx = document.getElementById('radius-slider').value;
        const markerPos = mapBase.latLngToContainerPoint(marker.getLatLng());
        
        // Apply the clipping circle to the top (color) map
        const colorMapEl = document.getElementById('map-color');
        colorMapEl.style.clipPath = `circle(${radiusPx}px at ${markerPos.x}px ${markerPos.y}px)`;
        
        // Update the visual dashed ring to match
        const center = marker.getLatLng();
        const edgePoint = mapBase.containerPointToLatLng([markerPos.x + parseInt(radiusPx), markerPos.y]);
        circle.setLatLng(center);
        circle.setRadius(center.distanceTo(edgePoint));
    }

    // UI Listeners
    marker.on('drag', () => {
        updateLens();
        const p = marker.getLatLng();
        document.getElementById('lat').innerText = p.lat.toFixed(4);
        document.getElementById('lng').innerText = p.lng.toFixed(4);
    });

    document.getElementById('radius-slider').oninput = updateLens;
    mapBase.on('zoom', updateLens);

    // Audio Logic
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "PROBE ACTIVE";
        isAudioActive = true;
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            document.getElementById('ele').innerText = ele + "m";
            if (isAudioActive) synth.triggerAttackRelease(150 + ele, "4n");
        } catch(err) { console.log("Elevation fetch error"); }
    });

    // Force initial render
    setTimeout(updateLens, 500);
}

window.onload = init;