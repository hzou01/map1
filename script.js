const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 
// New high-register notes for the expansion shimmer
const SHIMMER_NOTES = ["G5", "C6", "E6"]; 

const PROVIDENCE_ZONES = {
    INDUSTRIAL: [[41.815, -71.425], [41.835, -71.410]], 
    WATER: [[41.818, -71.405], [41.830, -71.398]],
    GREEN: [[41.824, -71.412], [41.832, -71.405]]
};

let map, marker, chimePoly, variationPoly, shimmerPoly, bassSynth, masterGain, lowPass, limiter;
let isAudioActive = false;
let currentRadius = 500;

function init() {
    const startPos = [41.8245, -71.4128]; 
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

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
        const sizeFactor = Math.min(currentRadius / 2000, 1.0);

        // 1. DYNAMIC BPM & FILTER (Environment)
        let targetBPM = 75;
        if (region.isInd) targetBPM = 130; 
        if (region.isWat || region.isGrn) targetBPM = 40;
        Tone.Transport.bpm.rampTo(targetBPM, 0.5);

        const filterFreq = (region.isGrn || region.isWat) ? 800 : 3500;
        lowPass.frequency.rampTo(filterFreq, 0.5);

        // 2. BACKGROUND FLOOR (Size Intensity)
        const baseVol = (region.isGrn || region.isWat) ? -15 : -30;
        bassSynth.volume.rampTo(baseVol + (sizeFactor * 10), 0.2);

        // 3. THE COMPLEX HARMONIC LAYER (The "Blossom")
        // This only kicks in when the probe is large (> 800m)
        const shimmerVol = sizeFactor > 0.4 ? -25 + (sizeFactor * 10) : -80; 
        shimmerPoly.volume.rampTo(shimmerVol, 1);
        
        masterReverb.wet.rampTo(region.isWat ? 0.75 : (0.1 + sizeFactor * 0.4), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            limiter = new Tone.Limiter(-1).toDestination();
            masterGain = new Tone.Gain(0.7).connect(limiter);

            masterReverb = new Tone.Reverb(12).connect(masterGain);
            const delay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

            // Layer 1: Core Chimes
            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.1, release: 2 }
            }).connect(lowPass);

            // Layer 2: Variation Accents
            variationPoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, release: 1.2 }
            }).connect(lowPass);

            // Layer 3: THE SHIMMER (New complex harmonic layer)
            shimmerPoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" }, // Slightly more "voice" than a sine
                envelope: { attack: 1.5, decay: 2, sustain: 0.4, release: 4 } // Slow swell
            }).connect(masterReverb); 
            shimmerPoly.volume.value = -80;

            bassSynth = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start();
            bassSynth.volume.value = -35;

            // Arpeggiator with high-tier logic
            new Tone.Loop(time => {
                // Core
                let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
                
                // Variation (Occasional)
                if (Math.random() > 0.7) {
                    let vNote = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                    variationPoly.triggerAttackRelease(vNote, "16n", time + 0.1, 0.3);
                }

                // Shimmer (Only triggered when probe is wide)
                if (currentRadius > 1000 && Math.random() > 0.8) {
                    let sNote = SHIMMER_NOTES[Math.floor(Math.random() * SHIMMER_NOTES.length)];
                    shimmerPoly.triggerAttackRelease(sNote, "2n", time, 0.2);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateAudio();
            startBtn.innerText = "PROBE ONLINE";
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        currentRadius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = currentRadius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        updateAudio();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    setTimeout(sync, 100);
}

window.onload = init;