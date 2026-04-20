const BASE_NOTES = ["C5", "G4", "E5", "B4"];
const DEEP_BASE_NOTES = ["C2", "G1", "F1", "A1"];

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain, lowPass;
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

    // THE AREA SCANNER: Pings 5 points (Center + N, S, E, W edges)
    function scanEnvironment() {
        if (!isAudioActive) return;
        const center = marker.getLatLng();
        const offset = (currentRadius / 111320); // Meters to Latitude degrees

        const points = [
            center,
            { lat: center.lat + offset, lng: center.lng },
            { lat: center.lat - offset, lng: center.lng },
            { lat: center.lat, lng: center.lng + offset },
            { lat: center.lat, lng: center.lng - offset }
        ];

        let industrialMix = 0;
        let greenMix = 0;
        let waterMix = 0;

        points.forEach(p => {
            // Industrial Logic (Near I-95 / Downtown core)
            if (p.lat < 41.822 && p.lng < -71.412) industrialMix += 0.2;
            // Green Logic (East Side / Parks)
            if (p.lng > -71.400) greenMix += 0.2;
            // Water Logic (River / Canal)
            if (p.lng > -71.406 && p.lng < -71.401) waterMix += 0.2;
        });

        updateAudioAverages(industrialMix, greenMix, waterMix);
    }

    function updateAudioAverages(ind, grn, wat) {
        const sizeFactor = currentRadius / 2000;

        // RHYTHM: A blend of all detected zones
        const targetBPM = 70 + (ind * 50) - (wat * 30) + (grn * 10);
        Tone.Transport.bpm.rampTo(Math.max(45, targetBPM), 1);

        // TEXTURE: The filter opens based on how much "Industrial" is in the circle
        lowPass.frequency.rampTo(1000 + (ind * 3500), 1);
        lowPass.Q.value = 1 + (ind * 5);

        // BASE VOLUME: Swells if ANY nature (green/water) is inside the probe
        const baseLevel = -30 + (grn * 12) + (wat * 15);
        bassSynth.volume.rampTo(baseLevel + (sizeFactor * 10), 1);

        // ATTACK: If the probe is mostly over a park, notes become softer
        chimePoly.set({ 
            envelope: { attack: 0.05 + (grn * 0.4) } 
        });

        masterReverb.wet.rampTo(0.1 + (sizeFactor * 0.4) + (wat * 0.4), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.8, 2);

            masterReverb = new Tone.Reverb({ decay: 10, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.35).connect(masterReverb);
            lowPass = new Tone.Filter(1500, "lowpass").connect(masterDelay);

            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 2 }
            }).connect(lowPass);

            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "triangle" },
                envelope: { attack: 3, release: 5 }
            }).connect(masterGain);
            bassSynth.triggerAttack(DEEP_BASE_NOTES[0]);
            bassSynth.volume.value = -30;

            // Arpeggiator
            new Tone.Loop(time => {
                let note = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
                chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
            }, "8n").start(0);

            // Shifting Base
            new Tone.Loop(time => {
                if (Math.random() > 0.6) {
                    currentBaseIndex = (currentBaseIndex + 1) % DEEP_BASE_NOTES.length;
                    bassSynth.frequency.rampTo(DEEP_BASE_NOTES[currentBaseIndex], 8);
                }
            }, "1n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            scanEnvironment();
            startBtn.innerText = "PROBE ACTIVE";
        } catch (e) { console.error(e); }
    };

    const sync = () => {
        currentRadius = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = currentRadius + "m";
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = currentRadius / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        scanEnvironment();
    };

    slider.oninput = sync;
    marker.on('drag', sync);
    map.on('zoom move', sync);
    setTimeout(sync, 150);
}

window.onload = init;