const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// YOUR ORIGINAL COLOR SCHEME (RGB)
const PALETTE = {
    HIGHWAY_RED: [252, 234, 173],    
    ROAD_ORANGE: [254, 253, 219],   
    STREET_YELLOW: [255, 255, 255], 
    HOUSE_GREY: [245, 238, 228],    
    PARK_GREEN: [225, 235, 213],    
    WATER_BLUE: [217, 231, 234]     
};

let map, marker, chimePoly, variationPoly, humLayer, subLayer, masterGain, lowPass, limiter;
let isAudioActive = false;

function init() {
    const startPos = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        crossOrigin: 'anonymous' 
    }).addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const startBtn = document.getElementById('start-btn');

    async function samplePoint() {
        if (!isAudioActive) return;
        const mapEl = document.getElementById('map');
        const canvas = await html2canvas(mapEl, {
            x: window.innerWidth / 2 - 1, 
            y: window.innerHeight / 2 - 1,
            width: 2, height: 2, useCORS: true
        });
        const ctx = canvas.getContext('2d');
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        const check = (col) => Math.sqrt((r-col[0])**2 + (g-col[1])**2 + (b-col[2])**2) < 30;

        updateAudio(
            check(PALETTE.HIGHWAY_RED), 
            check(PALETTE.ROAD_ORANGE), 
            check(PALETTE.STREET_YELLOW), 
            check(PALETTE.PARK_GREEN), 
            check(PALETTE.WATER_BLUE)
        );
    }

    function updateAudio(hwy, rod, str, grn, blu) {
        const size = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. DYNAMIC BPM
        let bpm = 70;
        if (hwy) bpm = 130;
        else if (rod) bpm = 105;
        else if (grn || blu) bpm = 48;
        Tone.Transport.bpm.rampTo(bpm, 0.2);

        // 2. TEXTURE & FILTER
        const freq = (hwy || rod || str) ? 4000 : (grn ? 650 : 1400);
        lowPass.frequency.rampTo(freq, 0.3);

        // 3. THE BASE (LOW TONE)
        // humLayer = low mids / subLayer = deep sub
        let baseVol = -35; 
        let subVol = -80; // Default off

        if (grn) { // Forest: Heavy, muffled base
            baseVol = -15;
            subVol = -20;
        } else if (blu) { // Ocean: Hazy, deep base
            baseVol = -20;
            subVol = -18;
        } else if (hwy || rod) { // Urban: Tight, industrial vibration
            baseVol = -25;
            subVol = -40;
        }

        humLayer.volume.rampTo(baseVol + (size * 6), 0.5);
        subLayer.volume.rampTo(subVol + (size * 8), 0.5);

        // REVERB (Cloudy for water)
        masterReverb.wet.rampTo(blu ? 0.75 : (grn ? 0.4 : 0.15), 0.5);
    }

    startBtn.onclick = async () => {
        await Tone.start();
        limiter = new Tone.Limiter(-1).toDestination();
        masterGain = new Tone.Gain(0.7).connect(limiter);

        masterReverb = new Tone.Reverb(12).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.3).connect(masterReverb);
        lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

        chimePoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.05, release: 2 }
        }).connect(lowPass);

        variationPoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.02, release: 1 }
        }).connect(lowPass);

        // THE BASE LAYERS
        humLayer = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start(); // C3 (Mid-low)
        subLayer = new Tone.Oscillator(65.41, "sine").connect(masterGain).start();      // C2 (Sub-base)
        
        humLayer.volume.value = -40;
        subLayer.volume.value = -80;

        new Tone.Loop(time => {
            let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
            chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            if (Math.random() > 0.7) {
                let vNote = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                variationPoly.triggerAttackRelease(vNote, "16n", time + 0.1, 0.3);
            }
        }, "8n").start(0);

        Tone.Transport.start();
        isAudioActive = true;
        samplePoint();
    };

    const sync = () => {
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = parseInt(slider.value) / metersPerPixel;

        document.getElementById('frost-layer').style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        samplePoint();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
}

window.onload = init;