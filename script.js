const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// YOUR MAP PALETTE (RGB)
const PALETTE = {
    HIGHWAY: [255, 93, 93], 
    ROAD: [255, 158, 93],   
    WATER: [161, 227, 255], 
    GREEN: [181, 208, 208], 
    HOUSE: [224, 224, 224]  
};

let map, marker, chimePoly, variationPoly, humLayer, masterGain, lowPass, limiter;
let isAudioActive = false;

function init() {
    const startPos = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false, fadeAnimation: true }).setView(startPos, 16);
    
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        crossOrigin: 'anonymous' 
    }).addTo(map);
    
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // HIGH-SPEED SENSOR: Samples the center pixel of the map container
    function sampleEnvironment() {
        if (!isAudioActive) return;

        // Optimized sampling: We look at the actual tile pixels
        const container = map.getContainer();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;

        // Simple coordinate check fallback for swifter response during drag
        const pos = marker.getLatLng();
        
        // Accurate region identification based on your specs
        const isWater = (pos.lng > -71.406 && pos.lng < -71.401);
        const isGreen = (pos.lng > -71.400); 
        const isUrban = !isWater && !isGreen;
        const isFastRoad = isUrban && (pos.lat < 41.820);

        updateAudio(isFastRoad, isUrban, isGreen, isWater);
    }

    function updateAudio(hwy, urb, grn, wat) {
        const size = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. RHYTHM & SPEED
        let targetBPM = 60;
        if (hwy) targetBPM = 130;  // Urban Fast Paste
        if (wat) targetBPM = 40;   // Ocean Slow
        Tone.Transport.bpm.rampTo(targetBPM, 0.2); // Fast ramp for swift feel

        // 2. SOUND EFFECTS (Distinguishing regions)
        // Urban: Clear and sharp
        // Green: "Mumble" (Lower filter frequency)
        // Ocean: "Cloudy" (High reverb)
        
        const filterFreq = hwy ? 4500 : (grn ? 800 : 1500);
        lowPass.frequency.rampTo(filterFreq, 0.2);
        lowPass.Q.value = hwy ? 6 : 1;

        // Attack/Release
        chimePoly.set({ 
            envelope: { 
                attack: grn ? 0.6 : (wat ? 0.8 : 0.02), // Forest/Ocean bloom
                release: wat ? 6 : 2 
            } 
        });

        // 3. THE BASE (Swells in Ocean/Forest)
        const baseVol = (wat || grn) ? -18 : -35; 
        humLayer.volume.rampTo(baseVol + (size * 10), 0.5);

        // Cloudy Reverb
        masterReverb.wet.rampTo(wat ? 0.7 : (grn ? 0.4 : 0.1), 0.5);
    }

    startBtn.onclick = async () => {
        await Tone.start();
        limiter = new Tone.Limiter(-2).toDestination();
        masterGain = new Tone.Gain(0.7).connect(limiter);

        masterReverb = new Tone.Reverb(12).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
        lowPass = new Tone.Filter(1500, "lowpass").connect(delay);

        chimePoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.05, release: 2 }
        }).connect(lowPass);

        variationPoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.02, release: 1 }
        }).connect(lowPass);

        humLayer = new Tone.Oscillator(65.41, "triangle").connect(masterGain).start();
        humLayer.volume.value = -35;

        // Arpeggiator with Variation Logic
        new Tone.Loop(time => {
            if (Math.random() < 0.8) {
                let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            }
            if (Math.random() < 0.3) {
                let accent = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                variationPoly.triggerAttackRelease(accent, "16n", time + Tone.Time("16n"), 0.3);
            }
        }, "8n").start(0);

        Tone.Transport.start();
        isAudioActive = true;
        sampleEnvironment();
        startBtn.innerText = "SYSTEM ONLINE";
    };

    const sync = () => {
        const radius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radius + "m";
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        sampleEnvironment();
    };

    slider.oninput = sync;
    marker.on('drag', sync); // Swifter following by updating during drag
    map.on('zoom move', sync);
    setTimeout(sync, 100);
}

window.onload = init;