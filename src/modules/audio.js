/* audio.js - Web Audio API 机器物理音效合成 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.vinylNoiseNode = null;
    this.rainNoiseNode = null;
    this.vinylGain = null;
    this.rainGain = null;
    this.isVinylPlaying = false;
    
    // 默认音量
    this.musicVolume = 0.5;
    this.envVolume = 0.3;
  }

  // 延迟初始化 AudioContext 避免被浏览器策略拦截
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 初始化黑胶背景底器与雨声
    this.setupVinylNoise();
    this.setupRainNoise();
  }

  // 1. 合成打字机按键声 (击键合成：带通滤波 + 快速衰减)
  playTypewriterKey() {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    // 缓冲区，0.1秒左右的材短白噪声
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // 带通滤波器模拟击键声的频率
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // 微小频率浮动，模拟每一次击键的物理起伏
    filter.frequency.value = 1000 + Math.random() * 800; 
    filter.Q.value = 4.0;

    // 增益控制：极快地衰减击键声
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.35 + Math.random() * 0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    // 连接节点并播放
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start();
  }

  // 2. 合成打字机回车铃声 (双正弦波合成 + 较慢衰减)
  playTypewriterBell() {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const time = ctx.currentTime;
    
    // 使用双正弦波叠加以产生清谆的金属敲击铃声
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1800, time); // 高频分量1
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2200, time); // 更高频分量
    
    oscGain.gain.setValueAtTime(0.2, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6); // 缓慢衰减

    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.6);
    osc2.stop(time + 0.6);
  }

  // 3. 合成盖油墨印章音效 (低通滤波器 + 低频冲击)
  playStampSound() {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const time = ctx.currentTime;

    // 模拟木质印章底座撞击桌面的低频沉闷声 (低频正弦波)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, time); // 95Hz 起始
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.15); // 频率向下偏移
    
    oscGain.gain.setValueAtTime(0.6, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    // 纸张与油墨接触摩擦沙沙声 (白噪声经过低通滤波)
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, time); // 合成低频的油墨摩擦声

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(time);
    noise.start(time);
    osc.stop(time + 0.3);
    noise.stop(time + 0.3);
  }

  // 4. 纸张嘶扯/装填物理音效
  playPaperRip() {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    
    const time = ctx.currentTime;
    const duration = 0.45;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // 生成调制的摩擦白噪音
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope * (0.15 + Math.random() * 0.1);
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.linearRampToValueAtTime(1400, time + duration); // 向上扫频，模拟嘶开动作的声调变化
    filter.Q.value = 1.0;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    source.start(time);
    source.stop(time + duration);
  }

  // 5. 摩尔斯电码音效合成
  playMorseTone(frequency = 750, durationSec) {
    this.init();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const time = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, time);

    // 微调启动与停止包络，遟免音频咔哒切断噪音
    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(0.12, time + 0.008); 
    gainNode.gain.setValueAtTime(0.12, time + durationSec - 0.008);
    gainNode.gain.linearRampToValueAtTime(0.001, time + durationSec);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + durationSec);

    return { osc, gainNode, stopTime: time + durationSec };
  }

  // 6. 黑胶唱片底器沙沙声
  setupVinylNoise() {
    const ctx = this.ctx;
    // 制作 2 秒周期的循环黑胶噪声缓冲区
    const duration = 2.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      // 基础沙沙声
      let noise = (Math.random() * 2 - 1) * 0.02;
      
      // 偶发的大爆豆破音 (旧黑胶痕迹)
      if (Math.random() < 0.00015) {
        noise += (Math.random() * 2 - 1) * 0.45;
      }
      
      // 对应 33转/分钟 的周转，每约 1.8 秒产生一次周性的微弱擦伤噪音
      const timeSec = i / ctx.sampleRate;
      const crackleEnv = Math.max(0, Math.cos((2 * Math.PI * timeSec) / 1.8));
      if (Math.random() < 0.0012 * crackleEnv) {
        noise += (Math.random() * 2 - 1) * 0.28;
      }
      
      data[i] = noise;
    }

    this.vinylGain = ctx.createGain();
    this.vinylGain.gain.value = this.musicVolume * 0.05; // 限制基础增益

    // 带通滤波以模拟老旧留声机频宽
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.6;

    this.vinylGain.connect(filter);
    filter.connect(ctx.destination);
    
    this.vinylBuffer = buffer;
  }

  // 7. 环境雨声合成
  setupRainNoise() {
    const ctx = this.ctx;
    const duration = 2.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // 使用粉紅噪声算法生成比白噪声更自然的雨声效果
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      
      data[i] = pink * 0.012; // 调整为合适雨声音量
    }

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = this.envVolume * 0.1;

    // 使用低通滤波器模拟隔着窗户听室外下雨的效果
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    this.rainGain.connect(filter);
    filter.connect(ctx.destination);
    
    this.rainBuffer = buffer;
  }

  // 启动背景声音
  startVinyl() {
    this.init();
    if (this.isVinylPlaying) return;
    
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    // 播放黑胶噪声
    this.vinylNoiseNode = ctx.createBufferSource();
    this.vinylNoiseNode.buffer = this.vinylBuffer;
    this.vinylNoiseNode.loop = true;
    this.vinylNoiseNode.connect(this.vinylGain);
    this.vinylNoiseNode.start(0);

    // 播放雨声
    this.rainNoiseNode = ctx.createBufferSource();
    this.rainNoiseNode.buffer = this.rainBuffer;
    this.rainNoiseNode.loop = true;
    this.rainNoiseNode.connect(this.rainGain);
    this.rainNoiseNode.start(0);

    this.isVinylPlaying = true;
  }

  // 停止背景声音
  stopVinyl() {
    if (!this.isVinylPlaying) return;
    
    if (this.vinylNoiseNode) {
      this.vinylNoiseNode.stop();
      this.vinylNoiseNode.disconnect();
      this.vinylNoiseNode = null;
    }
    
    if (this.rainNoiseNode) {
      this.rainNoiseNode.stop();
      this.rainNoiseNode.disconnect();
      this.rainNoiseNode = null;
    }

    this.isVinylPlaying = false;
  }

  // 动态调整黑胶唱片音量
  setVinylVolume(val) {
    this.musicVolume = val / 100;
    if (this.vinylGain) {
      this.vinylGain.gain.value = this.musicVolume * 0.05;
    }
  }

  // 动态调整雨声音量
  setRainVolume(val) {
    this.envVolume = val / 100;
    if (this.rainGain) {
      this.rainGain.gain.value = this.envVolume * 0.15;
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
