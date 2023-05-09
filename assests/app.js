const select = document.getElementById("audio-devices-input");
const selectedOptions = document.getElementById("audio-source");

// Create a new AudioContext
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
audioContext.suspend();
let mediaStream;
let sourceNode;

// ml5 code from https://learn.ml5js.org/#/reference/pitch-detection
let model_url =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe";

// Create synth object
const now = Tone.now();
const synth = new Tone.Synth({
  oscillator: {
    type: "sine",
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 1.0,
    release: 0.1,
  },
}).toDestination();
const activeNotes = [];

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

async function setup() {
  audioContext = new AudioContext();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  startPitch(stream, audioContext);
}

function startPitch(stream, audioContext) {
  pitch = ml5.pitchDetection(model_url, audioContext, stream, modelLoaded);
}

function modelLoaded() {
  getPitch();
}

// Allow audio to start
const meter = new Tone.Meter({
  channels: 1,
  smoothing: 0.9,
  normalRange: true,
  bufferSize: 1024,
});
let inputLevelValueRead = null;

const mic = new Tone.UserMedia().chain(meter);

function startAudio() {
  mic
    .open()
    .then(() => {
      console.log("Mic is open");
      resumeAudio();

      setup();
    })
    .catch((e) => {
      console.log("Mic is not open");
      console.log(e);
    });
}

function getPitch() {
  pitch.getPitch(function (err, frequency) {
    if (frequency) {
      frequency = frequency.toFixed(2);
      let midiInput = noteValueOfFrequency(frequency);
      let inputLevelValue = meter.getValue();
      let midiInputNote = frequencyToMIDI(frequency);

      console.log(
        "The Freq is:",
        frequency,
        "Hz",
        "\t",
        "Note:",
        midiInput,
        "\t",
        "The MIDI is:",
        midiInputNote,
        "\t",
        "The Level is:",
        inputLevelValue.toFixed(2)
      );

      if (inputLevelValue > 0.08) {
        pitchLength(inputLevelValue);
        synth.triggerAttack(
          Tone.Midi(midiInputNote).toFrequency(),
          "4n",
          now
        );
      } else {
        synth.triggerRelease(now);
      }
    } else {
      synth.triggerRelease(now + 0.1);
    }

    if (err) {
      err = "No pitch detected";
      console.log("ml5:", err);
    }
    getPitch();
  });
}

function noteValueOfFrequency(frequencyValue) {
  frequencyValue = Tone.Frequency(frequencyValue, "hz").toNote();
  return frequencyValue;
}

function frequencyToMIDI(frequency) {
  let midiNum = Tone.Frequency(frequency, "hz").toMidi();
  return midiNum;
}

function pitchLength(inputLevelValue) {
  if (inputLevelValueRead !== inputLevelValue) {
    inputLevelValueRead = inputLevelValue;
  }
}

// Select audio type
selectedOptions.addEventListener("change", (event) => {
  const selectedOptionValue = event.target.value;

  switch (selectedOptionValue) {
    case "audio":
      monoAudio();
      break;
    case "midi":
      midiAudio();
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
  midiInput = null;
  const monoOutput = new Tone.Mono();
  mic.connect(monoOutput);
  monoOutput.toDestination();
}

// MIDI AUDIO
function midiAudio() {
  console.log("Midi");
  mic.close();

  startAudio();
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
