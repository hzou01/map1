let map, marker, circle;
let synth, noise;

// 1. Initialize Sound
const startButton = document.getElementById('start-audio');
startButton.addEventListener('click', async () => {
    await Tone.start();
    synth = new Tone.PolySynth(Tone.Synth).toDestination();
    noise = new Tone.Noise("pink").start().toDestination();
    noise.volume.value = -60; // Start silent
    startButton.style.display = 'none';
});

// 2. Initialize Map
function initMap() {
    const center = { lat: 41.82, lng: -71.41 }; // Providence
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        center: center,
        disableDefaultUI: true,
        styles: [
            { "featureType": "all", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
            { "backgroundColor": "#111111" } // Dark Mode
        ]
    });

    marker = new google.maps.Marker({
        position: center,
        map: map,
        draggable: true
    });

    // Create the visual radius
    circle = new google.maps.Circle({
        map: map,
        radius: 500,
        fillColor: '#FFFFFF',
        fillOpacity: 0.1,
        strokeColor: '#FFFFFF',
        strokeOpacity: 0.5,
        strokeWeight: 1
    });

    // Update everything when marker moves
    marker.addListener("drag", () => {
        const pos = marker.getPosition();
        circle.setCenter(pos);
        updateUI(pos);
    });

    marker.addListener("dragend", () => {
        probeLocation(marker.getPosition());
    });
}

// 3. The "Probe" Logic
function probeLocation(pos) {
    const lat = pos.lat();
    const lng = pos.lng();
    const radius = parseInt(document.getElementById('radius-slider').value);
    circle.setRadius(radius);

    // Get Topography (Elevation)
    const elevator = new google.maps.ElevationService();
    elevator.getElevationForLocations({ locations: [pos] }, (results) => {
        if (results[0]) {
            const ele = results[0].elevation;
            document.getElementById('ele').innerText = Math.round(ele) + "m";
            
            // Map Elevation to Synth Pitch
            if(synth) synth.set({ detune: ele * 2 });
        }
    });

    // Get Categories (Places)
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({ location: pos, radius: radius }, (results) => {
        const parks = results.filter(p => p.types.includes('park')).length;
        const busy = results.length - parks;

        // Sound Mapping
        if(noise) noise.volume.rampTo(-30 + (busy), 0.5); // More city = more noise
        if(synth) synth.triggerAttackRelease(["C4", "E4"], "8n"); // Quick pulse on drop
    });
}

function updateUI(pos) {
    document.getElementById('coords').innerText = `${pos.lat().toFixed(4)}, ${pos.lng().toFixed(4)}`;
}

window.onload = initMap;