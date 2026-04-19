let map, marker, synth;
let noiseSynth, droneSynth, melodyPart;
let isAudioActive = false;
let isScanning = false;

// The "Musical Score" parameters
let urbanMood = {
    complexity: 0.5, // Buildings
    brightness: 500, // Parks
    activity: -40,   // Roads
    flow: 120        // Water
};

const SCALE = ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4"];

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const frost = document.getElementById('frost-layer');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // --- PROBE VISUALS ---
    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        const lat = markerLatLng.lat;
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const layerW = window.innerWidth + 200;
        const layerH = window.innerHeight + 200;

        const fullPath = `M 0 0 H ${layerW} V ${layerH} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.webkitClipPath = `path('${fullPath}')`;
        frost.style.clipPath = `path('${fullPath}')`;
    }

    // --- URBAN SCANNER ---
    async function scanUrbanDensity(lat, lng, radius) {
        if (isScanning || !isAudioActive) return;
        isScanning = true;
        
        const query = `[out:json][timeout:5];(
            node["leisure"="park"](around:${radius},${lat},${lng});
            way["highway"](around:${radius},${lat},${lng});
            way["building"](around:${radius},${lat},${lng});
            way["natural"="water"](around:${radius},${lat},${lng});
        );out count;`;

        try {
            const response = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query));
            const data = await response.json();
            const counts = data.elements[0].tags;
            
            // Update the Mood object
            urbanMood.complexity = Math.min(1, (parseInt(counts["building"]) || 0) / 50);
            urbanMood.brightness = Math.max(200, 2000 - (parseInt(counts["leisure/park"]) || 0) * 100);
            urbanMood.activity = Math.min(-10, -40 + (parseInt(counts["highway"]) || 0) * 0.5);
            urbanMood.flow = Math.max(40, 110 - (parseInt(counts["natural/water"]) || 0) * 5);

            // Apply to Audio Engine
            droneSynth.filter.frequency.rampTo(urbanMood.brightness, 2);
            noiseSynth.volume.rampTo(urbanMood.activity, 1);
            Tone.Transport.bpm.rampTo(urbanMood.flow, 3);
            
        } catch (e) { console.warn("Overpass Busy"); } finally { isScanning = false; }
    }

    // --- INTERACTION ---
    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);

    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        
        // 1. GENERATIVE MELODY SYNTH (The main music)
        const polySynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 }
        }).toDestination();

        // The Sequencer: Plays a note every 8th note
        const melodyLoop = new Tone.Loop(time => {
            // Chance to play a note based on "Complexity" (Buildings)
            if (Math.random() < (0.3 + urbanMood.complexity)) {
                // Pick a random note from our Pentatonic Scale
                const note = SCALE[Math.floor(Math.random() * SCALE.length)];
                polySynth.triggerAttackRelease(note, "8n", time);
            }
        }, "8n").start(0);

        // 2. BACKGROUND DRONE
        droneSynth = new Tone.AutoFilter("4n").toDestination().start();
        const osc = new Tone.OmniSynth({
            oscillator: { type: "pwm" },
            envelope: { attack: 4, release: 4 }
        }).connect(droneSynth);
        osc.triggerAttack("C2");

        // 3. INDUSTRIAL TEXTURE
        noiseSynth = new Tone.Noise("pink").toDestination();
        noiseSynth.volume.value = -40;
        noiseSynth.start();

        Tone.Transport.start();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
        
        const p = marker.getLatLng();
        scanUrbanDensity(p.lat, p.lng, parseInt(slider.value));
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        scanUrbanDensity(p.lat, p.lng, parseInt(slider.value));
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;