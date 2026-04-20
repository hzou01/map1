let map, marker, chimePoly, natureBase, waterPad, masterReverb, noiseSynth, waterFlow;
let isAudioActive = false;
let currentRatios = { red: 0, grey: 0, yellow: 0, blue: 0.5 };
let geoTimer; // For debouncing the API

function init() {
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        fadeAnimation: false 
    }).setView([41.8245, -71.4128], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);

        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const fullPath = `M 0 0 H ${w} V ${h} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;

        frost.style.clipPath = `path('${fullPath}')`;

        // --- DEBOUNCED SENSING ---
        // We wait 200ms after you stop moving to "ping" the server
        clearTimeout(geoTimer);
        geoTimer = setTimeout(() => {
            detectFeatures(centerLatLng);
        }, 200);
    }

    // NEW REVERSE GEOCODER LOGIC
    async function detectFeatures(latlng) {
        // Ping OpenStreetMap for the specific "type" of ground under the pin
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            // Log for debugging (Check your console to see what the pin 'sees')
            console.log("Sensed Location Type:", data.type, data.class);

            const category = data.class; // e.g., 'highway', 'building', 'water', 'natural'

            if (category === "highway" || category === "building" || category === "railway") {
                // URBAN STATE
                currentRatios.red = 0.8;
                currentRatios.grey = 0.9;
                currentRatios.yellow = 0.8;
                currentRatios.blue = 0.1;
            } else if (category === "water" || category === "natural") {
                // NATURE STATE
                currentRatios.red = 0.1;
                currentRatios.grey = 0.1;
                currentRatios.yellow = 0.1;
                currentRatios.blue = 0.9;
            } else {
                // NEUTRAL (Parks/Residential)
                currentRatios.red = 0.3;
                currentRatios.grey = 0.5;
                currentRatios.blue = 0.4;
            }
        } catch (e) {
            // Fallback if API fails: Use Zoom as a backup sensor
            const zoom = map.getZoom();
            currentRatios.blue = zoom < 13 ? 0.9 : 0.2;
            currentRatios.grey = zoom < 13 ? 0.1 : 0.8;
        }
        
        updateAudioEngine();
    }

    function updateAudioEngine() {
        if (!isAudioActive) return;

        const urbanDensity = (currentRatios.red + currentRatios.grey + currentRatios.yellow) / 3;
        const waterPresence = currentRatios.blue;

        // BPM Snap: Fast in City, Slow in Water
        const targetBPM = 25 + (urbanDensity * 120); 
        Tone.Transport.bpm.rampTo(Math.max(20, targetBPM), 0.8);

        // Node Stretching
        const nodeRelease = 0.5 + (waterPresence * 15.5);
        chimePoly.set({ envelope: { release: nodeRelease } });

        // Noise Ducking
        const noiseGain = -60 + (urbanDensity * 40) - (waterPresence * 20);
        noiseSynth.volume.rampTo(Math.min(-15, noiseGain), 0.5);

        // Reverb Blur
        masterReverb.wet.rampTo(0.1 + (waterPresence * 0.7), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            const limiter = new Tone.Limiter(-1).toDestination();
            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.3 }).connect(limiter);

            noiseSynth = new Tone.Noise("brown").connect(new Tone.Filter(150, "bandpass").connect(masterReverb));
            noiseSynth.start();

            waterFlow = new Tone.Noise("pink").connect(new Tone.AutoFilter("1n").connect(masterReverb).start());
            waterFlow.start();

            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.05, release: 1 }
            }).connect(masterReverb);

            new Tone.Loop(time => {
                const prob = 0.15 + (currentRatios.grey * 0.8);
                if (Math.random() < prob) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "32n", time);
                }
            }, "16n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            startBtn.innerText = "PROBE ACTIVE";
            syncProbe();
        } catch (e) { console.error(e); }
    };

    slider.oninput = syncProbe;
    map.on('move zoom', syncProbe);
    marker.on('drag', syncProbe);
}

window.onload = init;