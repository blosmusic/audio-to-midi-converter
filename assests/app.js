const select = document.getElementById("audio-devices-input");
const selectedOptions = document.getElementById("audio-source");

// Create a new AudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
audioContext.suspend();
let mediaStream;
let sourceNode;

// Create midi and synth objects
let midiInput;
const now = Tone.now();
const synth = new Tone.PolySynth({
  oscillator: {
    type: "sine2",
  },
  envelope: {
    attack: 0.1,
    decay: 0.1,
    sustain: 0.5,
    release: 0.1,
  },

  volume: -12,

  // Set the polyphony to 4 voices
  polyphony: 4,

  // Set the maximum number of voices to 4
  maxPolyphony: 4,

  // Set the portamento to 0.1 seconds
  portamento: 0.1,

  // Set the detune to 0 cents
  detune: 0,

  // Set the voice vibrato to 0.5 Hz with a depth of 0.5 semitones
  vibrato: {
    frequency: 0.5,
    depth: 0.5,
    type: "sine",
  },

  // Set the voice tremolo to 4 Hz with a depth of 0.25
  tremolo: {
    frequency: 4,
    depth: 0.25,
    type: "sine",
  },

  // Set the voice panning to -20% left with a width of 40%
  panning: {
    pan: -0.2,
    width: 0.4,
  },

  // Set the voice volume to -12 dB
  volume: -12,

  // Set the voice filter frequency to 440 Hz with a Q of 1
  filter: {
    type: "lowpass",
    frequency: 440,
    rolloff: -12,
    Q: 1,
  },
}).toDestination();

// Handle device selection change
select.addEventListener("change", async () => {
  const selectedDeviceId = select.value;

  // Check if there is an active MediaStream and disconnect it
  if (mediaStream && sourceNode) {
    sourceNode.disconnect();
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  try {
    // Create a MediaStream using the selected audio device
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: selectedDeviceId },
    });

    // Create a MediaStreamAudioSourceNode
    sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // Connect the source node to the audio context destination
    sourceNode.connect(audioContext.destination);
  } catch (error) {
    console.error("Error accessing audio device:", error);
  }
});

// Enumerate audio devices after user permission is granted
navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then(() => {
    // Enumerate audio devices
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        // Filter audio input devices
        const audioInputDevices = devices.filter(
          (device) => device.kind === "audioinput"
        );

        // Populate the select element with audio input devices
        audioInputDevices.forEach((device) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.text = device.label || `Audio Input ${device.deviceId}`;
          select.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("Error enumerating audio devices:", error);
      });
  })
  .catch((error) => {
    console.error("Error accessing audio device:", error);
  });

// Create Audio Permission
document.body.addEventListener("click", async () => {
  await Tone.start();
  document.querySelector("h4").innerText = "Permission Granted";
  console.log("audio is ready");
});

// Allow audio to start
const meter = new Tone.Meter();
let inputLevelValueRead = null;

const mic = new Tone.UserMedia().chain(meter);

function startAudio() {
  mic
    .open()
    .then(() => {
      console.log("Mic is open");
      resumeAudio();
    })
    .catch((e) => {
      console.log("Mic is not open");
      console.log(e);
    });
}

// Select audio type
selectedOptions.addEventListener("change", (event) => {
  const selectedOptionValue = event.target.value;

  switch (selectedOptionValue) {
    case "mono":
      monoAudio();
      break;
    case "stereo":
      stereoAudio();
      break;
    default:
      muteAudio();
      break;
  }
});

/// Audio Functions
// MONO AUDIO
function monoAudio() {
  console.log("Mono");
  startAudio();
  const monoOutput = new Tone.Mono();
  mic.connect(monoOutput);
  monoOutput.toDestination();
}

// STEREO AUDIO
function stereoAudio() {
  console.log("Stereo");
  startAudio();
  const monoLeft = new Tone.Mono({ channelCount: 1 });
  const monoRight = new Tone.Mono({ channelCount: -1 });
  mic.connect(monoLeft, monoRight);
  monoLeft.toDestination();
  monoRight.toDestination();
}

// MIDI AUDIO
function midiAudio() {
  console.log("Midi");
  mic.close();

  const midi = new Tone.Midi();

  // Enable the MIDI connection
  navigator
    .requestMIDIAccess()
    .then((access) => {
      const inputSelector = document.getElementById("midi-input-selector"); // HTML element to display input selection

      // Populate the inputSelector with available MIDI input options
      access.inputs.forEach((input) => {
        const option = document.createElement("option");
        option.value = input.id;
        option.text = input.name;
        inputSelector.appendChild(option);
      });

      // Event handler for input selection change
      inputSelector.addEventListener("change", (event) => {
        const selectedInputId = event.target.value;

        // Clear existing input event listeners for all devices
        access.inputs.forEach((input) => {
          input.onmidimessage = null;
        });

        if (
          selectedInputId !== "none" &&
          selectedOptions.value !== "mono" &&
          selectedOptions.value !== "stereo"
        ) {
          const selectedInput = access.inputs.get(selectedInputId);
          // Enable MIDI input for the selected device
          selectedInput.onmidimessage = handleMIDIMessage;
        }
      });

      // Event handler for audio output selection change
      selectedOptions.addEventListener("change", (event) => {
        const selectedOutput = event.target.value;
        const selectedInputId = inputSelector.value;

        if (
          selectedOutput === "mono" ||
          selectedOutput === "stereo" ||
          selectedOutput === "none"
        ) {
          // Clear existing input event listeners for all devices
          access.inputs.forEach((input) => {
            input.onmidimessage = null;
          });
        } else if (selectedInputId !== "none") {
          const selectedInput = access.inputs.get(selectedInputId);
          // Enable MIDI input for the selected device
          selectedInput.onmidimessage = handleMIDIMessage;
        }
      });
    })
    .catch((error) => {
      console.log("MIDI connection error:", error);
    });

  // Event handler for MIDI messages
  function handleMIDIMessage(message) {
    const command = message.data[0] & 0xf0;
    const note = message.data[1];
    const velocity = message.data[2];

    if (command === 144 && velocity > 0) {
      // Note On event
      const frequency = Tone.Midi(note).toFrequency();
      synth.triggerAttack(frequency);
      console.log("note on", note, velocity);
    } else if (command === 128 || (command === 144 && velocity === 0)) {
      // Note Off event
      const frequency = Tone.Midi(note).toFrequency();
      synth.triggerRelease(frequency);
    }
  }
}

// MUTE AUDIO
function muteAudio() {
  mic.close();
  audioContext.suspend();
  Tone.Transport.stop();
  console.log("Mute");
}

function resumeAudio() {
  // Resume the audio context
  if (audioContext.state === "suspended") {
    audioContext.resume();
    Tone.Transport.start();
  }
  console.log("Resume");
}
