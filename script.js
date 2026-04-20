/**
 * PROVIDENCE SOUND MAP V2.1 - Fixed Base Pause
 */

const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const VARIATION_NOTES = ["D5", "A4"]; 
const SHIMMER_NOTES = ["G5", "C6", "E6"]; 

const ZONES = {
    INDUSTRIAL: [[41.815, -71.425], [41.835, -71.410]], 
    WATER: [[41.818, -71.405], [41.830, -71.398]],
    GREEN: [[41.824, -71.412], [41.832, -71.405]]
};

let map, marker, chimePoly, variationPoly, shimmerPoly, bassSynth, masterGain, lowPass;
let isAudioActive = false;
let isPaused = false;
let currentRadius = 400;

function init() {
    const startPos = [41.827136,-71.409172]; 
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    startBtn.onclick = async () => {
        if (!isAudioActive) {
            await startAudio();
            updateBtnState("ACTIVE");
        } else if (!isPaused) {
            // --- PAUSE LOGIC ---
            Tone.Transport.pause();
            // We must silence the oscillator manually
            bassSynth.volume.rampTo(-100, 0.5); 
            isPaused = true;
            updateBtnState("PAUSED");
        } else {
            // --- RESUME LOGIC ---
            Tone.Transport.start();
            // Restore volume based on current map position
            updateAudio(); 
            isPaused = false;
            updateBtnState("ACTIVE");
        }
    };

    startBtn.ondblclick = () => {
        resetAudio();
        updateBtnState("IDLE");
    };

    async function startAudio() {
        await Tone.start();
        const limiter = new Tone.Limiter(-1).toDestination();
        masterGain = new Tone.Gain(0.7).connect(limiter);
        const reverb = new Tone.Reverb(12).connect(masterGain);
        const delay = new Tone.FeedbackDelay("8n.", 0.3).connect(reverb);
        lowPass = new Tone.Filter(2000, "lowpass").connect(delay);

        chimePoly = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.1, release: 2 } }).connect(lowPass);
        variationPoly = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.02, release: 1.2 } }).connect(lowPass);
        shimmerPoly = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 2, release: 4 } }).connect(reverb);
        shimmerPoly.volume.value = -80;

        // Background Base
        bassSynth = new Tone.Oscillator(130.81, "triangle").connect(masterGain).start();
        bassSynth.volume.value = -35;

        new Tone.Loop(time => {
            let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
            chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            if (Math.random() > 0.7) {
                let vNote = VARIATION_NOTES[Math.floor(Math.random() * VARIATION_NOTES.length)];
                variationPoly.triggerAttackRelease(vNote, "16n", time + 0.1, 0.3);
            }
            if (currentRadius > 1000 && Math.random() > 0.8) {
                let sNote = SHIMMER_NOTES[Math.floor(Math.random() * SHIMMER_NOTES.length)];
                shimmerPoly.triggerAttackRelease(sNote, "2n", time, 0.2);
            }
        }, "8n").start(0);

        Tone.Transport.start();
        isAudioActive = true;
        isPaused = false;
        updateAudio();
    }

    function resetAudio() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        [chimePoly, variationPoly, shimmerPoly, bassSynth].forEach(s => { if(s) s.dispose(); });
        isAudioActive = false;
        isPaused = false;
    }

    function updateAudio() {
        if (!isAudioActive || isPaused) return; // Don't update volume if paused
        const pos = marker.getLatLng();
        const inZ = (b) => pos.lat >= b[0][0] && pos.lat <= b[1][0] && pos.lng >= b[0][1] && pos.lng <= b[1][1];
        
        const isInd = inZ(ZONES.INDUSTRIAL);
        const isWat = inZ(ZONES.WATER);
        const isGrn = inZ(ZONES.GREEN);
        const size = Math.min(currentRadius / 2000, 1.0);

        Tone.Transport.bpm.rampTo(isInd ? 130 : (isWat || isGrn ? 40 : 75), 0.5);
        lowPass.frequency.rampTo(isGrn || isWat ? 850 : 3500, 0.5);
        
        bassSynth.volume.rampTo((isGrn || isWat ? -15 : -30) + (size * 12), 0.2);
        shimmerPoly.volume.rampTo(size > 0.4 ? -25 + (size * 10) : -80, 0.5);
    }

    function updateBtnState(state) {
        if (state === "ACTIVE") {
            startBtn.innerText = "PAUSE SYMPHONY";
            startBtn.style.background = "#ffd700";
            startBtn.style.color = "#000";
        } else if (state === "PAUSED") {
            startBtn.innerText = "RESUME SYMPHONY";
            startBtn.style.background = "#a1e3ff";
        } else {
            startBtn.innerText = "START SYMPHONY";
            startBtn.style.background = "#000";
            startBtn.style.color = "#fff";
        }
    }

    const sync = () => {
        currentRadius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        const center = map.latLngToContainerPoint(marker.getLatLng());
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pxR = currentRadius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${center.x} ${center.y} m -${pxR}, 0 a ${pxR},${pxR} 0 1,0 ${pxR * 2},0 a ${pxR},${pxR} 0 1,0 -${pxR * 2},0')`;
        
        if (isAudioActive && !isPaused) updateAudio();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    setTimeout(sync, 100);
}

window.onload = init;