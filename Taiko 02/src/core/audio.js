export function createAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffers = new Map();
    let masterGain = null;

    // マスターゲイン初期化
    function initMasterGain() {
        if (!masterGain) {
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.7;
            masterGain.connect(ctx.destination);
        }
    }

    // 音声ファイル読み込み
    async function loadAudio(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            buffers.set(url, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error('音声ファイル読み込みエラー:', error);
            return null;
        }
    }

    // 音声再生
    function play(buffer, when = 0, volume = 1.0) {
        if (!buffer) return null;

        initMasterGain();

        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(masterGain);

        gainNode.gain.value = volume;
        source.start(ctx.currentTime + when);

        return source;
    }

    // 太鼓の音効果音（簡易版）
    function createDrumSound(type) {
        const sampleRate = ctx.sampleRate;
        const duration = 0.1; // 100ms
        const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        const frequency = type === 'don' ? 200 : 400; // ドンは低音、カッは高音

        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 10); // 減衰
            data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
        }

        return buffer;
    }

    // 事前に太鼓の音を作成
    const donSound = createDrumSound('don');
    const kaSound = createDrumSound('ka');

    return {
        ctx,

        now() {
            return ctx.currentTime;
        },

        async loadSong(url) {
            return await loadAudio(url);
        },

        playSong(buffer, when = 0) {
            return play(buffer, when, 0.8);
        },

        playDon(when = 0) {
            return play(donSound, when, 0.6);
        },

        playKa(when = 0) {
            return play(kaSound, when, 0.6);
        },

        setVolume(volume) {
            if (masterGain) {
                masterGain.gain.value = Math.max(0, Math.min(1, volume));
            }
        },

        resume() {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
        }
    };
}
