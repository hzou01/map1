let map, marker, synth;
let isAudioActive = false;

function init() {
    // 1. Setup Map
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const frost = document.getElementById('frost-layer');

    // 2. Add Marker (Put it in the markerPane so it stays on top)
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        
        // Update Text
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

        // Calculate Pixel Radius
        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        
        // Calculate dynamic pixels-per-meter at current zoom
        const lat = markerLatLng.lat;
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        // Apply Mask to the Frost Layer
        // We use a Hard Stop (99% to 100%) for a clean edge
        const mask = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, black 99%, transparent 100%)`;
        
        frost.style.webkitMaskImage = mask;
        frost.style.maskImage = mask;
    }

    // 3. Listeners
    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);

    // Initial render
    setTimeout(syncProbe, 100);

    // 4. Audio & Elevation
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
        } catch(err) { console.warn("API throttle"); }
    });
}

window.onload = init;