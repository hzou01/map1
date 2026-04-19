let map, marker, droneSynth, noiseSynth, polySynth, melodyLoop;
let isAudioActive = false;

// We simulate your "TopToChop" ratios here
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 
const SCALE = ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4"];

function init() {
    // 1. Initialize Map
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const display = document.getElementById('radius-display');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    // 2. Visual Probe Logic
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
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.webkitClipPath = `path('${fullPath}')`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        // Simulating the "ChromaKey" analysis based on the probe's location
        // This is where your VCV Rack style interaction happens
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;
        // GREEN -> Filter Brightness
        const freq = 200 + (ratios.green * 3000);
        droneSynth.filter.frequency.rampTo(freq, 0.5);
        // GRAY -> Industrial Noise
        noiseSynth.volume.rampTo(-40 + (ratios.gray * 30), 0.5);
        // BLUE -> Tempo
        Tone.Transport.bpm.rampTo(60 + (ratios.blue * 100), 1);
    }

    // 3. THE BUTTON (The fix)
    startBtn.onclick = async () => {
        try {
            await Tone.start();
            console.log("Audio Context Started");

            // Define the instruments inside the click
            polySynth = new Tone.PolySynth(Tone.Synth).toDestination();
            
            droneSynth = {
                filter: new Tone.Filter(500, "lowpass").toDestination(),
                osc: new Tone.Oscillator("C2", "sawtooth")
            };
            droneSynth.osc.connect(droneSynth.filter).start();

            noiseSynth = new Tone.Noise("pink").toDestination();
            noiseSynth.volume.value = -40;
            noiseSynth.start();

            melodyLoop = new Tone.Loop(time => {
                // Note probability based on "Gray" density (Buildings)
                if (Math.random() < ratios.gray) {
                    const note = SCALE[Math.floor(Math.random() * SCALE.length)];
                    polySynth.triggerAttackRelease(note, "16n", time);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            startBtn.style.background = "#222";
            isAudioActive = true;
        } catch (err) {
            console.error("Audio failed to initialize:", err);
        }
    };

    // 4. Listeners
    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    
    // Simulate data change on drag end
    marker.on('dragend', () => {
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });

    setTimeout(syncProbe, 100);
}

window.onload = init;