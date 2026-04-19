let map, marker, synth;
let isAudioActive = false;

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const overlay = document.getElementById('probe-overlay');

    // FIX: Move marker to a higher pane so it's not hidden by the blur
    marker = L.marker([41.8245, -71.4128], { 
        draggable: true,
        pane: 'tooltipPane' // This sits at z-index 600
    }).addTo(map);

    function syncLens() {
    const radiusMeters = parseInt(slider.value);
    const markerLatLng = marker.getLatLng();
    
    // Update Text
    display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1)+"km" : radiusMeters+"m";

    // Pixel Math
    const centerPoint = map.latLngToContainerPoint(markerLatLng);
    const edgeLatLng = L.latLng(markerLatLng.lat, markerLatLng.lng + 0.01);
    const edgePoint = map.latLngToContainerPoint(edgeLatLng);
    const pixelsPerDegree = Math.abs(edgePoint.x - centerPoint.x);
    const metersPerDegree = markerLatLng.distanceTo(edgeLatLng);
    const pixelRadius = (radiusMeters / metersPerDegree) * pixelsPerDegree;

    // THE STABLE FIX: 
    // We create a radial gradient BACKGROUND. 
    // From 0 to pixelRadius, it is TOTALLY TRANSPARENT.
    // At pixelRadius + 1, it becomes the 40% white frost.
    const gradient = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, 
                      rgba(255, 255, 255, 0) 0%, 
                      rgba(255, 255, 255, 0) 100%, 
                      rgba(255, 255, 255, 0.5) 101%)`;
    
    overlay.style.background = gradient;
}

    slider.oninput = syncLens;
    map.on('zoom move', syncLens);
    marker.on('drag', syncLens);

    // Initial Sync
    setTimeout(syncLens, 100);

    // Audio Logic
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination();
        document.getElementById('start-btn').innerText = "SYSTEM ONLINE";
        isAudioActive = true;
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            if (isAudioActive && synth) synth.triggerAttackRelease(140 + ele, "1n");
        } catch(err) { console.log("Elevation error"); }
    });
}

window.onload = init;