const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// CORRECTED PALETTE: Based on your latest hex/rgb values
const PALETTE = {
    HIGHWAY_ORANGE: [252, 234, 173],    
    ROAD_YELLOW: [254, 253, 219],   
    STREET_WHITE: [255, 255, 255], 
    HOUSE_GREY: [245, 238, 228],    
    PARK_GREEN: [225, 235, 213],    
    WATER_BLUE: [217, 231, 234] 
};

let map, marker, chimePoly, variationPoly, humLayer, masterGain, lowPass, limiter;
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
        // Tiny sample area for speed
        const canvas = await html2canvas(mapEl, {
            x: window.innerWidth / 2 - 1, 
            y: window.innerHeight / 2 - 1,
            width: 2, height: 2, useCORS: true
        });
        const ctx = canvas.getContext('2d');
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // Strict color matcher
        const check = (col) => Math.sqrt((r-col[0])**2 + (g-col[1])**2 + (b-col[2])**2) < 10;

        updateAudio(
            check(PALETTE.HIGHWAY_ORANGE), 
            check(PALETTE.ROAD_YELLOW), 
            check(PALETTE.STREET_WHITE), 
            check(PALETTE.PARK_GREEN), 
            check(PALETTE.WATER_BLUE)
        );
    }

    function updateAudio(hwy, rod, str, grn, blu) {
        const size = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. OBVIOUS BPM CHANGES
        let targetBPM = 75;
        if (hwy) targetBPM = 140; // High-speed Orange
        else if (rod) targetBPM = 110; // Steady Yellow
        else if (grn || blu) targetBPM = 40; // Very slow Nature
        Tone.Transport.bpm.rampTo(targetBPM, 0.2);

        // 2. TEXTURE: Clear vs Cloudy
        const freq = (hwy || rod || str) ? 4500 : (grn ? 750 : 1600);
        lowPass.frequency.rampTo(freq, 0.2);

        // 3. PROLONGED BACKGROUND BASE (The "Interaction")
        // The base is ALWAYS on, but its character changes with size and color
        const baseVol = (grn || blu) ? -15 : -28;
        // As you drag the size BIGGER, the base gets LOUDER and heavier
        humLayer.volume.rampTo(baseVol + (size * 12), 0.1);
        
        // Reverb grows with size and Ocean detection
        masterReverb.wet.rampTo(blu ? 0.8 : (0.1 + size * 0.4), 0.1);
    }

    startBtn.onclick = async () => {
        await Tone.start();
        limiter = new Tone.Limiter(-1).toDestination();
        masterGain = new Tone.Gain(0.8).connect(limiter);

        masterReverb = new Tone.Reverb(15).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.3).connect(masterReverb);
        lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

        chimePoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.05, release: 2.5 }
        }).connect(lowPass);

        variationPoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.02, release: 1.2 }
        }).connect(lowPass);

        // THE BACKGROUND BASE: A low-end hum that never stops
        humLayer = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start(); // C3
        humLayer.volume.value = -30;

        new Tone.Loop(time => {
            let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
            chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            if (Math.random() > 0.75) {
                let vNote = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                variationPoly.triggerAttackRelease(vNote, "16n", time + 0.1, 0.3);
            }
        }, "8n").start(0);

        Tone.Transport.start();
        isAudioActive = true;
        samplePoint();
        startBtn.innerText = "PROBE ON";
    };

    const sync = () => {
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = parseInt(slider.value) / metersPerPixel;

        document.getElementById('frost-layer').style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        samplePoint(); // Update sound as you move
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
}

window.onload = init;