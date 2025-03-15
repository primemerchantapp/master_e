import { registeredWorklets } from '../core/worklet-registry.js';
import { CONFIG } from '../config/config.js';

/**
 * @class AudioStreamer
 * @description Manages the playback of audio data, including support for queuing, scheduling, and applying audio effects through worklets.
 */
export class AudioStreamer {
    /**
     * @constructor
     * @param {AudioContext} context - The AudioContext instance to use for audio processing.
     */
    constructor(context) {
        this.context = context;
        this.audioQueue = [];
        this.isPlaying = false;
        this.sampleRate = 24000;    // Default sample rate
        this.bufferSize = 7680;
        this.processingBuffer = new Float32Array(0);
        this.scheduledTime = 0;
        this.gainNode = this.context.createGain();
        this.source = this.context.createBufferSource();
        this.isStreamComplete = false;
        this.checkInterval = null;
        this.initialBufferTime = 0.05;
        this.endOfQueueAudioSource = null;
        this.onComplete = () => { };
        this.isInitialized = false;
        this.gainNode.connect(this.context.destination);
        this.addPCM16 = this.addPCM16.bind(this);
    }

    /**
     * Get the current sample rate
     */
    get sampleRate() {
        return this._sampleRate;
    }

    /**
     * Set the sample rate and update buffer size accordingly
     */
    set sampleRate(value) {
        this._sampleRate = value;
        // Update buffer size based on sample rate to maintain consistent timing
        this.bufferSize = Math.floor(value * 0.32); // 320ms buffer
    }

    /**
     * @method addPCM16
     * @description Adds a chunk of PCM16 audio data to the streaming queue.
     * @param {Int16Array} chunk - The audio data chunk.
     */
    addPCM16(chunk) {
        if (!this.isInitialized) {
            console.warn('AudioStreamer not initialized. Call initialize() first.');
            return;
        }

        const float32Array = new Float32Array(chunk.length / 2);
        const dataView = new DataView(chunk.buffer);

        for (let i = 0; i < chunk.length / 2; i++) {
            try {
                const int16 = dataView.getInt16(i * 2, true);
                float32Array[i] = int16 / 32768;
            } catch (e) {
                console.error(e);
            }
        }

        const newBuffer = new Float32Array(this.processingBuffer.length + float32Array.length);
        newBuffer.set(this.processingBuffer);
        newBuffer.set(float32Array, this.processingBuffer.length);
        this.processingBuffer = newBuffer;

        while (this.processingBuffer.length >= this.bufferSize) {
            const buffer = this.processingBuffer.slice(0, this.bufferSize);
            this.audioQueue.push(buffer);
            this.processingBuffer = this.processingBuffer.slice(this.bufferSize);
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.scheduledTime = this.context.currentTime + this.initialBufferTime;
            this.scheduleNextBuffer();
        }
    }
}

/**
 * Google TTS SSML Request with Correct Tagalog Pronunciation
 */
const textToSpeechRequest = {
    input: { ssml: `<speak>
      <prosody rate="90%" pitch="medium">
        <phoneme alphabet="ipa" ph="i.to">ITO</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="i.jo">IYO</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="a.ɾaw">ARAW</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="ɛh">EH</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="ma.ŋa">MGA</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="a.kin">AKIN</phoneme>
        <break time="100ms"/>
        <phoneme alphabet="ipa" ph="a.tin">ATIN</phoneme>
      </prosody>
    </speak>` },
    voice: { languageCode: "fil-PH", name: "fil-PH-Wavenet-A" },
    audioConfig: { audioEncoding: "LINEAR16" }
};