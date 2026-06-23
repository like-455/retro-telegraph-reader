/* telegraph.js - 摩尔斯电码与发报合成逻辑 */
import audioManager from './audio.js';

const MORSE_MAP = {
  'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',   'E': '.',
  'F': '..-.',  'G': '--.',   'H': '....',  'I': '..',    'J': '.---',
  'K': '-.-',   'L': '.-..',  'M': '--',    'N': '-.',    'O': '---',
  'P': '.--.',  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
  'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',  'Y': '-.--',
  'Z': '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
  ' ': ' '
};

// 摩尔斯时间常数 (以秒为单位)
const UNIT = 0.08; 
const DOT_DURATION = UNIT;
const DASH_DURATION = UNIT * 3;
const INTRA_CHARACTER_GAP = UNIT; // 同一个字母内各元素 (点/划) 之间的间隔
const LETTER_GAP = UNIT * 3;      // 字母与字母之间的间隔
const WORD_GAP = UNIT * 7;        // 单词与单词 (空格) 之间的间隔

// 常用字全拼字典
const PINYIN_DICT = {
  '张': 'ZHANG', '艺': 'YI', '兴': 'XING', '中': 'ZHONG', '国': 'GUO', 
  '电': 'DIAN', '报': 'BAO', '机': 'JI', '科': 'KE', '技': 'JI', 
  '美': 'MEI', '好': 'HAO', '日': 'RI', '常': 'CHANG', '阅': 'YUE', 
  '读': 'DU', '创': 'CHUANG', '作': 'ZUO', '我': 'WO', '爱': 'AI',
  '你': 'NI', '他': 'TA', '她': 'TA', '它': 'TA', '是': 'SHI',
  '一': 'YI', '个': 'GE', '这': 'ZHE', '那': 'NA', '的': 'DE',
  '有': 'YOU', '无': 'WU', '在': 'ZAI', '人': 'REN', '大': 'DA',
  '天': 'TIAN', '地': 'DI', '和': 'HE', '与': 'YU', '同': 'TONG'
};

// 汉字转拼音（全拼或拼音首字母）
function chineseToPinyin(text) {
  const result = [];
  const letters = "*abcdefghjklmnopqrstwxyz".split("");
  const boundary = [
    "啊","芭","擦","搭","蛾","发","噶","哈","击","喀","垃","妈","拿","哦","啪","期","然","撒","塌","挖","昔","压","匝"
  ];

  for (let char of text) {
    if (/[a-zA-Z0-9\s]/.test(char)) {
      result.push(char);
    } else if (PINYIN_DICT[char]) {
      result.push(PINYIN_DICT[char]);
    } else if (/[\u4e00-\u9fa5]/.test(char)) {
      // 经典 localeCompare 拼音首字母定位法
      let matched = false;
      for (let i = 0; i < boundary.length; i++) {
        if (char.localeCompare(boundary[i], "zh") < 0) {
          result.push(i > 0 ? letters[i].toUpperCase() : char);
          matched = true;
          break;
        }
      }
      if (!matched) result.push('Z'); // 兜底
    }
  }
  return result.join(' ');
}

export function textToMorse(text) {
  // 先将可能包含的汉字翻译成拼音英文
  const pinyinText = chineseToPinyin(text);
  return pinyinText.toUpperCase()
    .split('')
    .map(char => MORSE_MAP[char] || '')
    .filter(code => code !== '')
    .join(' ');
}

const REVERSE_MORSE_MAP = Object.entries(MORSE_MAP).reduce((acc, [char, code]) => {
  if (char !== ' ') acc[code] = char;
  return acc;
}, {});

export function morseToText(morseStr) {
  return morseStr.trim().split(/\s+/).map(code => REVERSE_MORSE_MAP[code] || '').join('');
}

/**
 * 摭放一段摩尔斯电码
 * @param {string} text 要摭放的源文本 (如 "SOS")
 * @param {function} onPulseChange 回调通知 UI 状态 (按键按下为 true，松开为 false)
 * @returns {Promise} 摭放完毕后的 resolve
 */
export function playMorseString(text, onPulseChange = () => {}) {
  const pinyinText = chineseToPinyin(text).toUpperCase();
  const audioCtx = audioManager.ctx || new (window.AudioContext || window.webkitAudioContext)();
  
  return new Promise((resolve) => {
    let delay = 0;
    
    for (let charIndex = 0; charIndex < pinyinText.length; charIndex++) {
      const char = pinyinText[charIndex];
      
      if (char === ' ') {
        delay += WORD_GAP;
        continue;
      }
      
      const code = MORSE_MAP[char];
      if (!code) continue;
      
      for (let symbolIndex = 0; symbolIndex < code.length; symbolIndex++) {
        const symbol = code[symbolIndex];
        const duration = symbol === '.' ? DOT_DURATION : DASH_DURATION;
        
        // 预先计算触发时间
        const currentDelay = delay;
        setTimeout(() => {
          onPulseChange(true, symbol); // 按键按下信号
          const { stopTime } = audioManager.playMorseTone(720, duration);
          
          // 声音摭放结束后通知 UI 松开按键
          const endTimeMs = (stopTime - audioCtx.currentTime) * 1000;
          setTimeout(() => {
            onPulseChange(false, '');
          }, Math.max(0, endTimeMs));
          
        }, currentDelay * 1000);
        
        delay += duration + INTRA_CHARACTER_GAP;
      }
      
      delay += LETTER_GAP - INTRA_CHARACTER_GAP; // 扣除多加的字母内间隔
    }
    
    // 延时完毕后 resolve
    setTimeout(resolve, delay * 1000);
  });
}

// 提供手动发报电键的按键音效控制
class ManualTelegraphKey {
  constructor() {
    this.oscillator = null;
    this.gainNode = null;
  }

  press() {
    audioManager.init();
    const ctx = audioManager.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    if (this.oscillator) return; // 已经按下发报中，避免重复触发

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.005); // 快速起音，防止爆音

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    
    this.oscillator = osc;
    this.gainNode = gain;
    this.pressStartTime = Date.now();
  }

  release() {
    if (!this.oscillator) return null;

    const ctx = audioManager.ctx;
    const time = ctx.currentTime;
    const duration = Date.now() - this.pressStartTime;

    const currentGain = this.gainNode;
    const currentOsc = this.oscillator;

    // 释放电键，淡出停止声音
    currentGain.gain.setValueAtTime(currentGain.gain.value, time);
    currentGain.gain.linearRampToValueAtTime(0.001, time + 0.008);
    currentOsc.stop(time + 0.01);

    this.oscillator = null;
    this.gainNode = null;

    // 根据按键按下持续时间判定是滴(点)还是哒(划)
    return duration < 180 ? '.' : '-';
  }
}

export const manualTelegraphKey = new ManualTelegraphKey();
