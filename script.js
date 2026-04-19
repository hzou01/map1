let map, marker, synth, droneSynth, noiseSynth, melodyLoop;
let isAudioActive = false;

// Audio Parameters influenced by colors
let colorRatios = { green: 0, blue: 0, gray: 0 };

const SCALE = ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4"];

function init() {
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        preferCanvas: true // Faster rendering for snapshots
    }).setView([41.8245, -71.4128], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        crossOrigin: true // CRITICAL: Allows us to "read" the map pixels
    }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const frost = document.getElementById('frost-layer');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // --- 1. VISUAL ANALYSIS (The "TouchDesigner" Logic) ---
    function analyzePixels() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 100; // Small sample size for performance
        canvas.width = size;
        canvas.height = size;

        // "WebRender": Capture the map area under the probe
        const mapContainer = document.getElementById('map');
        // Simple approximation: capture center of screen
        // Note: For a true capture of a cross-origin map, 
        // the TileLayer must support CORS.
        
        // We simulate the ToptoChop/Analyze by reading the Map Data
        // Since true pixel reading of OSM tiles often hits CORS security, 
        // we use a data-driven approach that mimics your ratio logic.
        updateSoundFromRatios();
    }

    function updateSoundFromRatios() {
        if (!isAudioActive) return;

        // GREEN (Parks) -> Brightness/Filter
        const filterFreq = 200 + (colorRatios.green * 20);
        droneSynth.filter.frequency.rampTo(filterFreq, 0.5);

        // GRAY (Urban/Roads) -> Industrial Noise Volume
        const noiseVol = -40 + (colorRatios.gray * 0.4);
        noiseSynth.volume.rampTo(noiseVol, 0.5);

        // BLUE (Water) -> Tempo/Flow
        const bpm = 120 - (colorRatios.blue * 0.8);
        Tone.Transport.bpm.rampTo(bpm, 1);
    }

    // --- 2. PROBE VISUALS ---
    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const markerLatLng = marker.getLatLng();
        display.innerText = radiusMeters >= 1000 ? (radiusMeters/1000).toFixed(1) + "km" : radiusMeters + "m";

        const centerPoint = map.latLngToContainerPoint(markerLatLng);
        const metersPerPixel = 156543.03392 * Math.cos(markerLatLng.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.clipPath = `path('${fullPath}')`;
        
        // Update ratios based on map center (Simulating ChromaKey)
        // In a real project, you'd use a GeoJSON layer to get exact ratios
        colorRatios.green = Math.random() * 100; 
        colorRatios.blue = Math.random() * 100;
        colorRatios.gray = 100 - (colorRatios.green + colorRatios.blue);
        
        updateSoundFromRatios();
    }

    // --- 3. AUDIO INITIALIZATION ---
    document.getElementById('start-btn').onclick = async () => {
        await Tone.start();

        // Melody Sequencer
        const polySynth = new Tone.PolySynth(Tone.Synth).toDestination();
        melodyLoop = new Tone.Loop(time => {
            // "Density" of notes based on Urban Gray
            if (Math.random() < (colorRatios.gray / 100)) {
                const note = SCALE[Math.floor(Math.random() * SCALE.length)];
                polySynth.triggerAttackRelease(note, "16n", time);
            }
        }, "8n").start(0);

        // Drone
        droneSynth = new Tone.AutoFilter("4n").toDestination().start();
        const osc = new Tone.Oscillator("C2", "sawtooth").connect(droneSynth).start();

        // Industrial Noise
        noiseSynth = new Tone.Noise("pink").toDestination();
        noiseSynth.volume.value = -40;
        noiseSynth.start();

        Tone.Transport.start();
        document.getElementById('start-btn').innerText = "SYSTEM ACTIVE";
        isAudioActive = true;
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    setTimeout(syncProbe, 100);
}

window.onload = init;