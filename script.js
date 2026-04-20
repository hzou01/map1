const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 
const DEEP_BASE_NOTES = ["C2", "G1", "F1", "A1"]; // Safe, melodic base shifts

const ZONES = {
    INDUSTRIAL: [[41.821, -71.418], [41.815, -71.414], [41.819, -71.403]],
    GREEN: [[41.831, -71.409], [41.826, -71.396], [41.784, -71.415]],
    WATER: [[41.824, -71.404], [41.818, -71.401], [41.829, -71.403]]
};

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, lowPass, limiter;
let isAudioActive = false;
let currentRadius = 500;
let currentBaseIndex = 0;

function init() {
    const startPos = [41.8245, -71.4128]; 
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function checkProximity(pos, zoneArray, threshold = 600) {
        return zoneArray.some(coord => L.latLng(coord).distanceTo(pos) < threshold);
    }

    function updateAudioParameters() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();
        
        // Capping the size factor so it doesn't blow out the speakers
        const sizeFactor = Math.min(currentRadius / 2000, 1.0);

        const isIndustrial = checkProximity(pos, ZONES.INDUSTRIAL, 700);
        const isGreen = checkProximity(pos, ZONES.GREEN, 800);
        const isWater = checkProximity(pos, ZONES.WATER, 400);

        // 1. RHYTHM
        let targetBPM = 60;
        if (isIndustrial) targetBPM = 105;
        if (isWater) targetBPM = 48;
        Tone.Transport.bpm.rampTo(targetBPM, 1.2);

        // 2. TEXTURE
        lowPass.frequency.rampTo(isIndustrial ? 3500 : 1200, 1);
        lowPass.Q.value = isIndustrial ? 4 : 1;

        const attackVal = isGreen ? 0.5 : 0.05;
        chimePoly.set({ envelope: { attack: attackVal, release: 2 + (sizeFactor * 3) } });

        // 3. CONTROLLED BASE VOLUME
        // We use a lower multiplier (* 6 instead of * 10) to keep it safe
        const baseVol = (isGreen || isWater) ? -20 : -30;
        bassSynth.volume.rampTo(baseVol + (sizeFactor * 6), 1);
        
        masterReverb.wet.rampTo(0.1 + (sizeFactor * 0.4), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            // SAFETY FIRST: The Limiter prevents the "broken microphone" sound
            limiter = new Tone.Limiter(-2).toDestination();
            masterGain = new Tone.Gain(0).connect(limiter);
            masterGain.gain.rampTo(0.7, 2);

            masterReverb = new Tone.Reverb({ decay: 12, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.3).connect(masterReverb);
            lowPass = new Tone.Filter(1500, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 2 }
            }).connect(lowPass);

            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "triangle" },
                envelope: { attack: 3, release: 5 }
            }).connect(masterGain);
            bassSynth.triggerAttack(DEEP_BASE_NOTES[0]);
            bassSynth.volume.value = -30;

            // MELODY LOOP
            new Tone.Loop(time => {
                let pool = Math.random() > 0.85 ? VARIATION_NOTES : BASE_NOTES;
                let note = pool[Math.floor(Math.random() * pool.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.35);
            }, "8n").start(0);

            // GENTLE BASE VARIATION
            new Tone.Loop(time => {
                if (Math.random() > 0.7) {
                    currentBaseIndex = (currentBaseIndex + 1) % DEEP_BASE_NOTES.length;
                    bassSynth.frequency.rampTo(DEEP_BASE_NOTES[currentBaseIndex], 10);
                }
            }, "2n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateAudioParameters();
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
        updateAudioParameters();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    setTimeout(sync, 150);
}

window.onload = init;