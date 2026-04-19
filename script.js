let mapSharp, mapBlur, marker, synth;
let isAudioActive = false;

function init() {
    const startPos = [41.8245, -71.4128];
    const mapOptions = { zoomControl: false, attributionControl: false };

    // 1. Initialize both maps
    mapSharp = L.map('map-sharp', mapOptions).setView(startPos, 15);
    mapBlur = L.map('map-blur', mapOptions).setView(startPos, 15);

    const tilesUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tilesUrl).addTo(mapSharp);
    L.tileLayer(tilesUrl).addTo(mapBlur);

    // 2. Sync Map Movements (If one moves, both move)
    mapSharp.on('move', () => {
        mapBlur.setView(mapSharp.getCenter(), mapSharp.getZoom(), { animate: false });
    });

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const blurMapDiv = document.getElementById('map-blur');

    // 3. Add the Marker to the SHARP map (Z-index 1000 pane)
    marker = L.marker(startPos, { 
        draggable: true,
        zIndexOffset: 1000 
    }).addTo(mapSharp);

    function syncLens() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        
        // Update Text
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

        // Calculate Pixel Radius
        const centerPoint = mapSharp.latLngToContainerPoint(markerLatLng);
        const edgeLatLng = L.latLng(markerLatLng.lat, markerLatLng.lng + 0.005);
        const edgePoint = mapSharp.latLngToContainerPoint(edgeLatLng);
        const pixelsPerDegree = Math.abs(edgePoint.x - centerPoint.x);
        const metersPerDegree = markerLatLng.distanceTo(edgeLatLng);
        const pixelRadius = (radiusMeters / metersPerDegree) * pixelsPerDegree;

        // THE PUNCH-HOLE:
        // We make the blurry map TRANSPARENT inside the radius.
        const mask = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, transparent 99%, black 100%)`;
        blurMapDiv.style.webkitMaskImage = mask;
        blurMapDiv.style.maskImage = mask;
    }

    // 4. Interaction Events
    slider.oninput = syncLens;
    mapSharp.on('zoom move', syncLens);
    marker.on('drag', syncLens);

    // Force initial render
    setTimeout(syncLens, 200);

    // 5. Audio & Elevation
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            if (isAudioActive && synth) synth.triggerAttackRelease(140 + ele, "1n");
        } catch(err) { console.warn("API Delay"); }
    });
}

window.onload = init;