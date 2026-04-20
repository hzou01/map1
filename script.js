const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, lowPass, limiter;
let isAudioActive = false;
let currentRadius = 500;

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // NEW: Real-world Region Identification
    async function identifyRegion() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();
        
        try {
            // "Sneak" a request to the naming service to see what's under the pin
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            const type = data.type || "";
            const category = data.category || "";

            // LOGIC BASED ON REAL MAP TAGS
            let isIndustrial = (category === "highway" || type === "industrial" || type === "railway");
            let isGreen = (category === "leisure" || type === "park" || type === "forest" || category === "landuse");
            let isWater = (category === "natural" && (type === "water" || type === "river" || type === "bay"));

            updateAudio(isIndustrial, isGreen, isWater);
        } catch (e) { /* Fallback to last known state if rate-limited */ }
    }

    function updateAudio(ind, grn, wat) {
        const sizeFactor = Math.min(currentRadius / 2000, 1.0);

        // 1. RHYTHM
        let targetBPM = 65;
        if (ind) targetBPM = 110; 
        if (wat) targetBPM = 42;
        Tone.Transport.bpm.rampTo(targetBPM, 1.5);

        // 2. TEXTURE
        lowPass.frequency.rampTo(ind ? 3800 : 1300, 1);
        lowPass.Q.value = ind ? 5 : 1;
        chimePoly.set({ envelope: { attack: grn ? 0.4 : 0.05 } });

        // 3. SAFE HUM (Not "Dramatic" Base)
        // Fixed at -30dB, only moves slightly with size
        const humVol = -32 + (sizeFactor * 5); 
        bassSynth.volume.rampTo(humVol, 1);
        
        masterReverb.wet.rampTo(0.1 + (sizeFactor * 0.3) + (wat ? 0.3 : 0), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            limiter = new Tone.Limiter(-3).toDestination(); // Hard ceiling
            masterGain = new Tone.Gain(0.7).connect(limiter);

            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(1500, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 2 }
            }).connect(lowPass);

            // STABLE HUM (Soft Triangle, no shifting notes)
            bassSynth = new Tone.Oscillator(130.81, "triangle").connect(masterGain); // Low C
            bassSynth.start();
            bassSynth.volume.value = -35;

            new Tone.Loop(time => {
                let pool = Math.random() > 0.8 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            identifyRegion();
            startBtn.innerText = "PROBE ONLINE";
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        currentRadius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = currentRadius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        identifyRegion(); // Now asks the map what's there
    };

    slider.oninput = sync;
    marker.on('dragend', sync); // Use dragend to avoid over-calling the API
    map.on('zoom move', sync);
    setTimeout(sync, 150);
}

window.onload = init;