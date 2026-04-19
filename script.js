let map, marker, synth;
let isAudioActive = false;

function init() {
    // 1. Setup Map
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 2. Elements
    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const overlay = document.getElementById('probe-overlay');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 3. The Lens Calculation Logic
    function syncLens() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        
        // Update Text Display
        if (radiusMeters >= 1000) {
            display.innerText = (radiusMeters / 1000).toFixed(1) + "km";
        } else {
            display.innerText = radiusMeters + "m";
        }

        // Convert Meters to Pixels based on current Zoom level
        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        
        // Calculate a point on the edge of the radius to get pixel distance
        const edgeLatLng = L.GeometryUtil.destination(markerLatLng, 90, radiusMeters);
        const edgePoint = map.latLngToContainerPoint(edgeLatLng);
        const pixelRadius = Math.abs(edgePoint.x - centerPoint.x);

        // Apply Mask to Overlay
        const mask = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, black 100%, transparent 100%)`;
        overlay.style.webkitMaskImage = mask;
        overlay.style.maskImage = mask;
    }

    // 4. Listeners
    slider.oninput = syncLens;
    map.on('zoom move', syncLens);
    marker.on('drag', syncLens);

    // Force Initial Sync
    setTimeout(syncLens, 100);

    // 5. Audio & Elevation
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
        } catch(err) { console.log("Elevation API lag."); }
    });
}

// Leaflet GeometryUtil polyfill (simple version)
L.GeometryUtil = {
    destination: function (latlng, heading, distance) {
        const R = 6378137; // Earth radius in meters
        const d = distance / R;
        const h = (heading * Math.PI) / 180;
        const lat1 = (latlng.lat * Math.PI) / 180;
        const lng1 = (latlng.lng * Math.PI) / 180;

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(h));
        const lng2 = lng1 + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

        return L.latLng((lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI);
    }
};

window.onload = init;