let map, marker, chimePoly, natureBase, waterPad, masterReverb;
let isAudioActive = false;
let ratios = { green: 0.2, gray: 0.6, blue: 0.2 }; 

const SCALES = {
    high: ["C5", "Eb5", "G5", "Bb5", "C6"],
    mid: ["G3", "Bb3", "C4"],
    low: ["C1", "G1"]
};

function init() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.8245, -71.4128], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const slider = document.getElementById('radius-slider');
    const frost = document.getElementById('frost-layer');
    const startBtn = document.getElementById('start-btn');
    marker = L.marker([41.8245, -71.4128], { draggable: true }).addTo(map);

    function syncProbe() {
        const radiusMeters = parseInt(slider.value);
        const centerPoint = map.latLngToContainerPoint(marker.getLatLng());
        const metersPerPixel = 156543.03392 * Math.cos(marker.getLatLng().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
        const pixelRadius = radiusMeters / metersPerPixel;

        const holeX = centerPoint.x + 100; 
        const holeY = centerPoint.y + 100;
        const fullPath = `M 0 0 H ${window.innerWidth + 200} V ${window.innerHeight + 200} H 0 Z M ${holeX} ${holeY} m -${pixelRadius}, 0 a ${pixelRadius},${pixelRadius} 0 1,0 ${pixelRadius * 2},0 a ${pixelRadius},${pixelRadius} 0 1,0 -${pixelRadius * 2},0`;
        frost.style.clipPath = `path('${fullPath}')`;
        
        updateAudioParams();
    }

    function updateAudioParams() {
        if (!isAudioActive) return;

        // 1. URBAN (High): Speed & Filter
        Tone.Transport.bpm.rampTo(80 + (ratios.gray * 100), 1);
        chimePoly.volume.rampTo(-15 + (ratios.gray * 10), 0.5);

        // 2. WATER (Mid): Stretched Reverb & Volume
        // As blue increases, the sound gets "Cloudier"
        masterReverb.wet.rampTo(0.1 + (ratios.blue * 0.8), 1);
        waterPad.volume.rampTo(-35 + (ratios.blue * 25), 1);

        // 3. NATURE (Low): Mushy Base Swell
        natureBase.volume.rampTo(-40 + (ratios.green * 30), 1);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // GLOBAL EFFECTS
            masterReverb = new Tone.Reverb({ decay: 8, wet: 0.2 }).toDestination();
            const chorus = new Tone.Chorus(2, 2, 0.5).connect(masterReverb).start();

            // HIGH CHIMES
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                envelope: { attack: 0.1, release: 2 }
            }).connect(chorus);

            // MID STRETCH (The "Cloudy" Layer)
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 4, release: 10 }
            }).connect(chorus);

            // LOW MUSHY BASE
            const lowFilter = new Tone.Filter(150, "lowpass").connect(masterReverb);
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 2, release: 6 }
            }).connect(lowFilter);

            // THE GENERATIVE LOOP
            new Tone.Loop(time => {
                // High Layer: Urban (16th notes)
                if (Math.random() < (0.1 + ratios.gray * 0.7)) {
                    const note = SCALES.high[Math.floor(Math.random() * SCALES.high.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // Mid & Low Layers: Triggered on every Half Note (Steady Pulse)
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("2n").toNumber() === 0) {
                    // Nature Base
                    const bNote = SCALES.low[Math.floor(Math.random() * SCALES.low.length)];
                    natureBase.triggerAttackRelease(bNote, "1n", time);

                    // Water Pad
                    const mNote = SCALES.mid[Math.floor(Math.random() * SCALES.mid.length)];
                    waterPad.triggerAttackRelease(mNote, "1n", time);
                }
            }, "8n").start(0);

            Tone.Transport.start();
            startBtn.innerText = "PROBE ACTIVE";
            isAudioActive = true;
        } catch (err) { console.error(err); }
    };

    slider.oninput = syncProbe;
    map.on('zoom move', syncProbe);
    marker.on('drag', syncProbe);
    marker.on('dragend', () => {
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;