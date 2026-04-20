const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// COORDINATE LOOKUP (Manually defined Providence zones)
const PROVIDENCE_ZONES = {
    // I-95 corridor and Commuter Rail tracks
    INDUSTRIAL: [[41.815, -71.425], [41.835, -71.410]], 
    // The Woonasquatucket and Providence Rivers
    WATER: [[41.818, -71.405], [41.830, -71.398]],
    // Burnside Park, Prospect Terrace, and East Side greenery
    GREEN: [[41.824, -71.412], [41.832, -71.405]]
};

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

    // High-speed coordinate check (replacing the API)
    function getManualRegion(pos) {
        const inZone = (bounds) => pos.lat >= bounds[0][0] && pos.lat <= bounds[1][0] && 
                                   pos.lng >= bounds[0][1] && pos.lng <= bounds[1][1];
        
        return {
            isInd: inZone(PROVIDENCE_ZONES.INDUSTRIAL),
            isWat: inZone(PROVIDENCE_ZONES.WATER),
            isGrn: inZone(PROVIDENCE_ZONES.GREEN)
        };
    }

    function updateAudio() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();
        const region = getManualRegion(pos);
        
        // 0.0 to 1.0 factor based on slider
        const sizeFactor = Math.min(currentRadius / 2000, 1.0);

        // 1. RHYTHM (Urban fast, Water slow)
        let targetBPM = 70;
        if (region.isInd) targetBPM = 125; 
        if (region.isWat || region.isGrn) targetBPM = 40;
        Tone.Transport.bpm.rampTo(targetBPM, 0.5);

        // 2. TEXTURE (Mumble vs Clear)
        const filterFreq = (region.isGrn || region.isWat) ? 800 : 3500;
        lowPass.frequency.rampTo(filterFreq, 0.5);
        lowPass.Q.value = region.isInd ? 6 : 1;

        // 3. THE BACKGROUND FLOOR (Interacts with size)
        // Prolonged hum that gets heavier as the probe grows
        const baseVol = (region.isGrn || region.isWat) ? -15 : -30;
        bassSynth.volume.rampTo(baseVol + (sizeFactor * 12), 0.2);
        
        // Cloudy Reverb
        masterReverb.wet.rampTo(region.isWat ? 0.7 : (0.1 + sizeFactor * 0.4), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            limiter = new Tone.Limiter(-2).toDestination();
            masterGain = new Tone.Gain(0.7).connect(limiter);

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(2000, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, release: 2.5 }
            }).connect(lowPass);

            // STABLE BACKGROUND HUM (Prolonged triangle)
            bassSynth = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start();
            bassSynth.volume.value = -35;

            new Tone.Loop(time => {
                let pool = Math.random() > 0.75 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.35);
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateAudio();
            startBtn.innerText = "PROBE ACTIVE";
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
        
        updateAudio();
    };

    slider.oninput = sync;
    marker.on('drag', sync); // Instant feedback during drag
    map.on('zoom move', sync);
    
    // Initial clear
    setTimeout(sync, 100);
}

window.onload = init;