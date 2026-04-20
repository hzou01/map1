const CONSTANT_CHORD = ["C3", "E3", "G3", "B3", "C4"];

let map, marker, chordPoly, bassSynth, masterReverb, masterDelay, masterGain;
let isAudioActive = false;
let blend = { urban: 0, nature: 0 };

function init() {
    const startPos = [41.8245, -71.4128]; // Kennedy Plaza
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(startPos, 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(startPos, { draggable: true }).addTo(map);

    const slider = document.getElementById('radius-slider');
    const radiusDisplay = document.getElementById('radius-value');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');

    function calculateWarp() {
        const radiusMeters = parseInt(slider.value);
        if (radiusDisplay) radiusDisplay.innerText = radiusMeters + "m";
        const pos = marker.getLatLng();
        
        // 1. Urban Intensity (The "Resonance")
        const pvdDist = pos.distanceTo([41.8245, -71.4128]);
        blend.urban = Math.max(0, 1 - (pvdDist / 3000));

        // 2. Nature/Water Intensity (The "Lag")
        const isNature = (pos.lng > -71.402 && pos.lat < 41.815) || pvdDist > 1500;
        blend.nature = isNature ? 0.8 : 0.0;

        if (isAudioActive) updateAudioEngine(radiusMeters / 2000);
    }

    function updateAudioEngine(size) {
        // SPEED: Faster in the city, dragging/lagging in nature
        const targetBPM = 60 + (blend.urban * 60) - (blend.nature * 20);
        Tone.Transport.bpm.rampTo(Math.max(40, targetBPM), 0.5);

        // LAGGING EFFECT (Delay): More echo in nature/water
        masterDelay.wet.rampTo(0.1 + (blend.nature * 0.5), 1.0);
        masterDelay.delayTime.rampTo(blend.nature > 0.5 ? "2n" : "8n", 1.0);

        // RESONANCE: Urban areas make the filter "sharper"
        chordPoly.set({
            modulationIndex: 2 + (blend.urban * 15),
            harmonicity: 1 + (blend.urban * 0.5)
        });

        // BASS: Grows with probe size
        bassSynth.volume.rampTo(-20 + (size * 10), 0.5);
        
        // REVERB: Space increases with probe size
        masterReverb.wet.rampTo(0.1 + (size * 0.5), 1.0);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();
            
            // Output chain: Synth -> Delay -> Reverb -> Master
            masterGain = new Tone.Gain(0).toDestination();
            masterGain.gain.rampTo(1, 2);

            masterReverb = new Tone.Reverb({ decay: 15, wet: 0.2 }).connect(masterGain);
            masterDelay = new Tone.FeedbackDelay("4n", 0.6).connect(masterReverb);

            // THE MELODY (Constant Chord)
            chordPoly = new Tone.PolySynth(Tone.FMSynth, {
                oscillator: { type: "sine" },
                envelope: { attack: 1, decay: 1, sustain: 1, release: 5 }
            }).connect(masterDelay);

            // THE BASS (Grounding Root)
            bassSynth = new Tone.MonoSynth({
                oscillator: { type: "sine" },
                envelope: { attack: 2, release: 5 }
            }).connect(masterGain);
            bassSynth.triggerAttack("C2");
            bassSynth.volume.value = -25;

            // THE LOOP: Playing the same notes constantly, but with changing speed
            new Tone.Loop(time => {
                // Randomly trigger notes from the constant chord
                const note = CONSTANT_CHORD[Math.floor(Math.random() * CONSTANT_CHORD.length)];
                chordPoly.triggerAttackRelease(note, "2n", time, 0.4);
            }, "4n").start(0);

            Tone.Transport.start();
            isAudioActive = true;
            calculateWarp();
            startBtn.innerText = "PROBE ACTIVE";
        } catch (e) { console.error(e); }
    };

    const update = () => {
        const radiusMeters = parseInt(slider.value);
        const centerLatLng = marker.getLatLng();
        const centerPoint = map.latLngToContainerPoint(centerLatLng);
        const zoom = map.getZoom();
        const metersPerPixel = 156543.03392 * Math.cos(centerLatLng.lat * Math.PI / 180) / Math.pow(2, zoom);
        const pixelRadius = radiusMeters / metersPerPixel;

        frost.style.clipPath = `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${centerPoint.x} ${centerPoint.y} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0')`;
        calculateWarp();
    };

    slider.oninput = update;
    marker.on('drag', update);
    map.on('zoom move', update);
}

window.onload = init;