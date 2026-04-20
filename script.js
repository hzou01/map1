const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// YOUR ORIGINAL COLOR SCHEME (Hex to RGB)
const PALETTE = {
    HIGHWAY_RED: [255, 93, 93],    // #ff5d5d
    ROAD_ORANGE: [255, 158, 93],   // #ff9e5d
    STREET_YELLOW: [253, 242, 204], // #fdf2cc
    HOUSE_GREY: [224, 224, 224],    // #e0e0e0
    PARK_GREEN: [181, 208, 208],    // #b5d0d0
    WATER_BLUE: [161, 227, 255]     // #a1e3ff
};

let map, marker, chimePoly, variationPoly, humLayer, masterGain, lowPass, limiter;
let isAudioActive = false;

function init() {
    const startPos = [41.8245, -71.4128];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    
    // Voyager tiles have the cleanest matches for your palette
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        crossOrigin: 'anonymous' 
    }).addTo(map);
    
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    // FAST COLOR SENSING: No screenshots, just direct pixel sampling
    async function samplePoint() {
        if (!isAudioActive) return;
        
        // Use html2canvas only on the tiny 1x1 area at the marker's tip
        const mapEl = document.getElementById('map');
        const canvas = await html2canvas(mapEl, {
            x: window.innerWidth / 2 - 1, 
            y: window.innerHeight / 2 - 1,
            width: 2,
            height: 2,
            useCORS: true,
            logging: false
        });

        const ctx = canvas.getContext('2d');
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // Color Matcher (Distance threshold)
        const check = (col) => Math.sqrt((r-col[0])**2 + (g-col[1])**2 + (b-col[2])**2) < 20;

        const isHwy = check(PALETTE.HIGHWAY_RED);
        const isRoad = check(PALETTE.ROAD_ORANGE);
        const isStreet = check(PALETTE.STREET_YELLOW);
        const isGreen = check(PALETTE.PARK_GREEN);
        const isBlue = check(PALETTE.WATER_BLUE);

        updateAudio(isHwy, isRoad, isStreet, isGreen, isBlue);
    }

    function updateAudio(hwy, rod, str, grn, blu) {
        const size = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. BPM / SPEED LOGIC
        let bpm = 70;
        if (hwy) bpm = 135;
        if (rod) bpm = 110;
        if (str) bpm = 90;
        if (grn || blu) bpm = 45; // Significant slowdown for nature
        Tone.Transport.bpm.rampTo(bpm, 0.1);

        // 2. FILTERS (Clear vs Mumble)
        const freq = (hwy || rod || str) ? 4000 : (grn ? 700 : 1500);
        lowPass.frequency.rampTo(freq, 0.1);
        lowPass.Q.value = hwy ? 6 : 1;

        // 3. BASE & EFFECTS
        // Nature (Green/Blue) brings in the heavy, cloudy base
        const baseVol = (grn || blu) ? -18 : -35;
        humLayer.volume.rampTo(baseVol + (size * 8), 0.2);

        // Attack Logic: Nature "blooms" in, Roads hit "sharp"
        const attack = (grn || blu) ? 0.6 : 0.02;
        chimePoly.set({ envelope: { attack: attack } });
        
        // Cloudy Reverb for Water
        masterReverb.wet.rampTo(blu ? 0.7 : (grn ? 0.4 : 0.1), 0.2);
    }

    startBtn.onclick = async () => {
        await Tone.start();
        limiter = new Tone.Limiter(-2).toDestination();
        masterGain = new Tone.Gain(0.7).connect(limiter);

        masterReverb = new Tone.Reverb(10).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.3).connect(masterReverb);
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

        new Tone.Loop(time => {
            let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
            chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            
            // Subtle random variation
            if (Math.random() > 0.7) {
                let vNote = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                variationPoly.triggerAttackRelease(vNote, "16n", time + 0.1, 0.2);
            }
        }, "8n").start(0);

        Tone.Transport.start();
        isAudioActive = true;
        samplePoint();
    };

    const sync = () => {
        const radius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radius + "m";
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        samplePoint();
    };

    slider.oninput = sync;
    marker.on('drag', sync); 
    map.on('zoom move', sync);
}

window.onload = init;