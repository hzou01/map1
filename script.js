 // A fixed, melodic sequence that is bright and pleasant
const FIXED_MELODY = ["C5", "G4", "E5", "B4"]; 

let map, marker, chimePoly, bassSynth, masterReverb, masterDelay, masterGain;
let isAudioActive = false;
let currentRadius = 500;

function init() {
    const startPos = [41.8245, -71.4128]; // Central Providence
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function updateAudioParameters() {
        const pos = marker.getLatLng();
        const pvdCenter = [41.8245, -71.4128];
        const dist = pos.distanceTo(pvdCenter);
        
        // 0.0 (Nature) to 1.0 (Urban)
        const urbanFactor = Math.max(0, 1 - (dist / 3000));
        const sizeFactor = currentRadius / 2000;

        if (!isAudioActive) return;

        // SPEED: Urban is slightly more driving, nature is more "drifting"
        Tone.Transport.bpm.rampTo(65 + (urbanFactor * 25), 0.5);

        // TEXTURE: High-pass filter for the "Industrial/Road" resonance
        // As you hit the city, the sound becomes "thinner" and more resonant
        chimePoly.set({
            envelope: { release: 1 + (sizeFactor * 4) } 
        });

        // REVERB: Large probe = huge space
        masterReverb.wet.rampTo(0.1 + (sizeFactor * 0.5), 1);
        
        // BASS: Deep grounding root that follows the probe size
        bassSynth.volume.rampTo(-30 + (sizeFactor * 15), 0.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(0.8, 1.5); // Soft start

            // THE EFFECTS CHAIN: Rhythmic "Instagram" bounce
            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("8n.", 0.4).connect(masterReverb);

            // THE INSTRUMENT: Pure, soft sine wave (No weird FM distortion)
            chimePoly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 2 }
            }).connect(masterDelay);

            // THE BASS: Grounding Root
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 1, release: 3 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");
            bassSynth.volume.value = -30;

            // THE MELODY: Precise and Repeating
            let i = 0;
            new Tone.Loop(time => {
                let note = FIXED_MELODY[i % FIXED_MELODY.length];
                // Occasionally skip a note to create "air"
                if (Math.random() > 0.1) {
                    chimePoly.triggerAttackRelease(note, "16n", time, 0.4);
                }
                i++;
            }, "8n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            updateAudioParameters();
            startBtn.innerText = "SYSTEM ACTIVE";
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
}

window.onload = init;