let map, marker, synth;
let noiseSynth, droneSynth, rhythmLoop;
let isAudioActive = false;
let isScanning = false;

function init() {
    // 1. Setup Map
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

    // --- URBAN SONIFICATION ENGINE ---
    async function scanUrbanDensity(lat, lng, radius) {
        if (isScanning || !isAudioActive) return;
        isScanning = true;
        
        // Querying for Parks, Roads, Buildings, and Water
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
            updateAudioParameters(counts);
        } catch (e) { console.warn("Overpass Busy"); } finally { isScanning = false; }
    }

    function updateAudioParameters(data) {
        const parks = parseInt(data["leisure/park"]) || 0;
        const roads = parseInt(data["highway"]) || 0;
        const buildings = parseInt(data["building"]) || 0;
        const water = parseInt(data["natural/water"]) || 0;

        // Parks soften the sound (Low pass filter)
        const filterFreq = Math.max(200, 2000 - (parks * 100));
        droneSynth.filter.frequency.rampTo(filterFreq, 2);

        // Roads increase industrial "hiss"
        const noiseVol = Math.min(-10, -40 + (roads * 0.5));
        noiseSynth.volume.rampTo(noiseVol, 1);

        // Building density increases drone pitch tension
        const baseHz = 40 + (buildings * 0.2);
        droneSynth.oscillator.frequency.rampTo(baseHz, 2);

        // Water slows the rhythm (BPM)
        const tempo = Math.max(40, 110 - (water * 5));
        Tone.Transport.bpm.rampTo(tempo, 3);
    }

    // --- INTERACTION ---
    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);

    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();
        
        // Base City Drone (Driven by Buildings)
        droneSynth = new Tone.AutoFilter("4n").toDestination().start();
        const osc = new Tone.OmniSynth({
            oscillator: { type: "pwm" },
            envelope: { attack: 2, release: 2 }
        }).connect(droneSynth);
        osc.triggerAttack(40);

        // Industrial Noise (Driven by Roads)
        noiseSynth = new Tone.Noise("pink").toDestination();
        noiseSynth.volume.value = -40;
        noiseSynth.start();

        // Heartbeat Rhythm (Driven by Water)
        const memSynth = new Tone.MembraneSynth({ volume: -10 }).toDestination();
        rhythmLoop = new Tone.Loop(time => {
            memSynth.triggerAttackRelease("C1", "8n", time);
        }, "4n").start(0);

        // Elevation Synth (Current logic)
        synth = new Tone.MonoSynth({ oscillator: { type: "sine" }, volume: -15 }).toDestination();

        Tone.Transport.start();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
        
        // Initial Scan
        const p = marker.getLatLng();
        scanUrbanDensity(p.lat, p.lng, parseInt(slider.value));
    };

    marker.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        const r = parseInt(slider.value);
        
        // Fetch Elevation for immediate pitch change
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${p.lat},${p.lng}`);
            const data = await res.json();
            const ele = Math.round(data.results[0].elevation);
            if (isAudioActive && synth) synth.triggerAttackRelease(140 + ele, "1n");
        } catch(err) { console.warn("Elevation API Busy"); }

        // Run deeper Urban Scan
        scanUrbanDensity(p.lat, p.lng, r);
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;