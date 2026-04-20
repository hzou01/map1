const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 

// COORDINATE BOUNDARIES (The "Invisible Map")
const ZONES = {
    // I-95, Route 6, and the Rail Corridor (High Speed)
    HIGHWAY: [
        {lat: 41.821, lng: -71.418}, {lat: 41.818, lng: -71.414}, 
        {lat: 41.828, lng: -71.417}, {lat: 41.835, lng: -71.415}
    ],
    // The River, Canal, and the Bay (Slow/Cloudy)
    WATER: [
        {lat: 41.824, lng: -71.403}, {lat: 41.819, lng: -71.401}, 
        {lat: 41.830, lng: -71.404}, {lat: 41.810, lng: -71.395}
    ],
    // Burnside Park, Prospect Terrace, Roger Williams (Mumble/Heavy Base)
    GREEN: [
        {lat: 41.825, lng: -71.411}, {lat: 41.831, lng: -71.409}, 
        {lat: 41.784, lng: -71.415}, {lat: 41.826, lng: -71.396}
    ],
    // Downtown, Federal Hill, Residential (Standard Pace)
    URBAN: [
        {lat: 41.823, lng: -71.413}, {lat: 41.820, lng: -71.421}, 
        {lat: 41.826, lng: -71.400}
    ]
};

let map, marker, chimePoly, variationPoly, humLayer, masterGain, lowPass, limiter;
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

    // HELPER: Check proximity to a list of coordinates
    function checkZone(pos, zoneCoords, dist = 500) {
        return zoneCoords.some(target => L.latLng(target).distanceTo(pos) < dist);
    }

    function updateAudio() {
        if (!isAudioActive) return;
        const pos = marker.getLatLng();
        const sizeFactor = Math.min(currentRadius / 2000, 1.0);

        // DETECT REGION
        const isHwy = checkZone(pos, ZONES.HIGHWAY, 600);
        const isWater = checkZone(pos, ZONES.WATER, 400);
        const isGreen = checkZone(pos, ZONES.GREEN, 500);
        const isUrban = checkZone(pos, ZONES.URBAN, 800);

        // 1. DYNAMIC BPM
        let bpm = 75;
        if (isHwy) bpm = 140;      // Fast Highway
        if (isWater || isGreen) bpm = 42; // Nature Slowdown
        Tone.Transport.bpm.rampTo(bpm, 0.5);

        // 2. TEXTURE (Mumble vs Clear)
        const filterFreq = (isGreen || isWater) ? 750 : 3500;
        lowPass.frequency.rampTo(filterFreq, 0.5);

        // 3. BACKGROUND BASE (Interaction with Size)
        // Prolonged triangle tone that swells as you drag the slider
        const baseLevel = (isGreen || isWater) ? -14 : -28;
        humLayer.volume.rampTo(baseLevel + (sizeFactor * 14), 0.2);

        // Reverb wetness based on Water & Size
        masterReverb.wet.rampTo(isWater ? 0.8 : (0.1 + sizeFactor * 0.4), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            limiter = new Tone.Limiter(-1).toDestination();
            masterGain = new Tone.Gain(0.7).connect(limiter);

            masterReverb = new Tone.Reverb(12).connect(masterGain);
            const delay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, release: 2.5 }
            }).connect(lowPass);

            variationPoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, release: 1.5 }
            }).connect(lowPass);

            // THE PROLONGED BACKGROUND BASE (Low C)
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
            updateAudio();
            startBtn.innerText = "PROBE ACTIVE";
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        currentRadius = parseInt(slider.value);
        // FIX: Update the text number immediately
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = currentRadius / metersPerPixel;

        // FIX: Instant frost update
        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        
        updateAudio();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    
    // FIX: Clear the initial blur immediately
    setTimeout(sync, 50);
}

window.onload = init;