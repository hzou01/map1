let map, marker, synth;
let isAudioActive = false;

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const overlay = document.getElementById('probe-overlay');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncLens() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        
        // Update Text
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1)+"km" : radiusMeters+"m";

        // Pixel Math
        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        
        // Use a 100m reference to find the current pixels-per-meter
        const offsetLatLng = L.latLng(markerLatLng.lat, markerLatLng.lng + 0.01);
        const offsetPoint = map.latLngToContainerPoint(offsetLatLng);
        const pixelsPerDegree = Math.abs(offsetPoint.x - centerPoint.x);
        const metersPerDegree = markerLatLng.distanceTo(offsetLatLng);
        
        const pixelRadius = (radiusMeters / metersPerDegree) * pixelsPerDegree;

        // Apply "Destination-Out" Mask
        const mask = `radial-gradient(circle ${pixelRadius}px at ${centerPoint.x}px ${centerPoint.y}px, black 100%, transparent 100%)`;
        overlay.style.webkitMaskImage = mask;
        overlay.style.maskImage = mask;
    }

    slider.oninput = syncLens;
    map.on('zoom move touchmove', syncLens);
    marker.on('drag', syncLens);

    setTimeout(syncLens, 100);

    // Audio & Elevation
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
        } catch(err) { console.log("Elevation Syncing..."); }
    });
}

window.onload = init;