let map, marker, chimePoly, natureBase, waterPad, bitCrusher;
let isAudioActive = false;
let ratios = { green: 0.3, gray: 0.5, blue: 0.2 }; 

// Pentatonic scales for harmony
const HIGH_CHIMES = ["C5", "D5", "G5", "A5", "C6"]; 
const MID_PAD = ["G3", "A3", "C4", "D4"];
const DEEP_BASE = ["C2", "G2"];

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

        // 1. URBAN (Gray): Fast BPM + Subtle Grit
        const urbanTempo = 90 + (ratios.gray * 110); // Up to 200 BPM
        Tone.Transport.bpm.rampTo(urbanTempo, 1);
        chimePoly.volume.rampTo(-10 + (ratios.gray * 10), 0.5);

        // 2. NATURE (Green): Bring out the Deep Base
        // The base gets louder and the "attack" gets softer/longer
        natureBase.volume.rampTo(-40 + (ratios.green * 35), 1.5);
        
        // 3. WATER (Blue): The Mid-Layer "Cloud"
        // This is the "Medium Tonal" sound you wanted
        waterPad.volume.rampTo(-45 + (ratios.blue * 35), 1.5);
    }

    startBtn.onclick = async () => {
        try {
            await Tone.start();

            // HIGH: Natural Chimes (FM Synth)
            chimePoly = new Tone.PolySynth(Tone.FMSynth, {
                modulationIndex: 5,
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 1.5 }
            }).toDestination();

            // MID: The Water Pad (Cloudy/Medium)
            waterPad = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 3, release: 5 }
            }).toDestination();

            // LOW: The Nature Base (Deep/Long)
            natureBase = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 2, release: 8 }
            }).toDestination();

            // GENERATIVE SEQUENCER
            new Tone.Loop(time => {
                // URBAN: Fast Pings (Based on Gray)
                if (Math.random() < (0.1 + ratios.gray * 0.8)) {
                    const note = HIGH_CHIMES[Math.floor(Math.random() * HIGH_CHIMES.length)];
                    chimePoly.triggerAttackRelease(note, "16n", time);
                }

                // MID/LOW: Only trigger on downbeats for that "Score" feel
                if (Tone.Transport.getTicksAtTime(time) % Tone.Ticks("1n").toNumber() === 0) {
                    // Trigger Nature Base
                    if (Math.random() < ratios.green + 0.2) {
                        const note = DEEP_BASE[Math.floor(Math.random() * DEEP_BASE.length)];
                        natureBase.triggerAttackRelease(note, "1n", time);
                    }
                    // Trigger Water Pad (Medium tone)
                    if (Math.random() < ratios.blue + 0.2) {
                        const note = MID_PAD[Math.floor(Math.random() * MID_PAD.length)];
                        waterPad.triggerAttackRelease(note, "1n", time);
                    }
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
        // Simulating the "TopToChop" analysis
        ratios.green = Math.random(); 
        ratios.gray = Math.random();
        ratios.blue = 1 - (ratios.green + ratios.gray);
        syncProbe();
    });
    setTimeout(syncProbe, 100);
}

window.onload = init;