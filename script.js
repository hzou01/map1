const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

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
        
        const canvas = await html2canvas(mapEl, {
            x: window.innerWidth / 2 - 1, 
            y: window.innerHeight / 2 - 1,
            width: 2, height: 2, useCORS: true
        });
        const ctx = canvas.getContext('2d');
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // NEW: Channel Dominance Logic (More accurate for pale colors)
        // Checks if Green is the dominant color (Park)
        const isGreen = (g > r + 5 && g > b); 
        // Checks if Blue is the dominant color (Water)
        const isBlue = (b > r + 2 && b > g);
        // Checks for the specific Orange highway tint
        const isOrange = (r > 240 && g > 220 && b < 200);

        updateAudio(isOrange, isGreen, isBlue);
    }

    function updateAudio(hwy, grn, blu) {
        const size = Math.min(parseInt(slider.value) / 2000, 1.0);

        // 1. FORCED BPM CHANGE
        let targetBPM = 85; // Default Street/House
        if (hwy) targetBPM = 145; // Highway Orange
        if (grn || blu) targetBPM = 38; // SLOW DOWN: Nature/Water
        
        Tone.Transport.bpm.rampTo(targetBPM, 0.1);

        // 2. TEXTURE: Sharp vs Muffled
        const filterFreq = (grn || blu) ? 700 : 4000;
        lowPass.frequency.rampTo(filterFreq, 0.2);

        // 3. BACKGROUND BASE (Interaction with Size)
        // Swells significantly as the probe gets bigger
        const baseLevel = (grn || blu) ? -12 : -28;
        humLayer.volume.rampTo(baseLevel + (size * 15), 0.1);
        
        // Clouds/Reverb for Water
        masterReverb.wet.rampTo(blu ? 0.85 : (0.1 + size * 0.4), 0.1);
    }

    startBtn.onclick = async () => {
        await Tone.start();
        limiter = new Tone.Limiter(-1).toDestination();
        masterGain = new Tone.Gain(0.8).connect(limiter);

        masterReverb = new Tone.Reverb(15).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
        lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

        chimePoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.05, release: 3 }
        }).connect(lowPass);

        variationPoly = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.02, release: 1.5 }
        }).connect(lowPass);

        // PERMANENT BACKGROUND BASE
        humLayer = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start();
        humLayer.volume.value = -30;

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
        startBtn.innerText = "PROBE ON";
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