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
    
    display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

    const centerPoint = map.latLngToContainerPoint(markerLatLng);
    
    // Meter to Pixel Conversion
    const lat = markerLatLng.lat;
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    const pixelRadius = radiusMeters / metersPerPixel;

    /**
     * THE STABLE CLIP-PATH:
     * We calculate the position relative to the frost-layer (which is shifted by -100px)
     */
    const holeX = centerPoint.x + 100;
    const holeY = centerPoint.y + 100;

    // Use setProperty to update the hole position and size
    // We use 'evenodd' logic to tell the browser this is a cutout
    frost.style.setProperty('--hole-path', `circle(${pixelRadius}px at ${holeX}px ${holeY}px)`);
    
    // Standardizing the clip-path for cross-browser support
    frost.style.clipPath = `path('M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
    frost.style.webkitClipPath = frost.style.clipPath;
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