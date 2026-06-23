/* main.js - 复古电报每日阅读器核必入口与事件联动系统 */
import audioManager from './modules/audio.js';
import { playMorseString, manualTelegraphKey, textToMorse, morseToText } from './modules/telegraph.js';
import { initStampSystem } from './modules/stamp.js';
import { newspaperReader } from './modules/newspaper.js';
import html2canvas from 'html2canvas';

// 1. 剝始化虚拟打字机键盘
function initTypewriterKeyboard() {
  const keyboard = document.getElementById('typewriter-keyboard');
  if (!keyboard) return;

  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ['SPACE']
  ];

  rows.forEach((rowKeys, rowIndex) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';

    rowKeys.forEach(key => {
      const keyEl = document.createElement('div');
      keyEl.className = 'key-cap';
      if (key === 'SPACE') {
        keyEl.classList.add('space-key');
        keyEl.textContent = ' ';
        keyEl.setAttribute('data-key', ' ');
      } else {
        keyEl.textContent = key;
        keyEl.setAttribute('data-key', key.toLowerCase());
      }

      // 鼠标/触屏点击键的键盘
      keyEl.addEventListener('mousedown', () => {
        triggerKeyAction(key === 'SPACE' ? ' ' : key.toLowerCase());
      });

      rowEl.appendChild(keyEl);
    });

    keyboard.appendChild(rowEl);
  });

  // 绑定实体物理键盘
  window.addEventListener('keydown', (e) => {
    // 忽略一些功能键，或者是当用户在摩尔斯电码输入框打字时
    if (e.target.tagName === 'TEXTAREA' && e.target.id !== 'chinese-input-trap') {
      return; 
    }
    
    // 如果是创作模式下，按回车触发换行叮声
    if (e.key === 'Enter') {
      e.preventDefault();
      audioManager.playTypewriterBell();
      newspaperReader.jigglePaper();
      if (newspaperReader.isTyping === false && activeMode === 'write') {
        insertCharToPaper('\n');
      }
      // 保持 textarea 里的值为空，方便后面输入
      const trap = document.getElementById('chinese-input-trap');
      if (trap) trap.value = '';
      return;
    }

    // 回退删除支持
    if (e.key === 'Backspace') {
      if (activeMode === 'write') {
        e.preventDefault();
        deleteCharFromPaper();
      }
      return;
    }

    const keyChar = e.key.toLowerCase();
    const keyCap = document.querySelector(`.key-cap[data-key="${keyChar}"]`);
    if (keyCap) {
      keyCap.classList.add('pressed');
      triggerKeyAction(keyChar);
    }
  });

  window.addEventListener('keyup', (e) => {
    const keyChar = e.key.toLowerCase();
    const keyCap = document.querySelector(`.key-cap[data-key="${keyChar}"]`);
    if (keyCap) {
      keyCap.classList.remove('pressed');
    }
  });

  // 中文输入法 IME 支持逻辑
  const trap = document.getElementById('chinese-input-trap');
  if (trap) {
    let isComposing = false;

    trap.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    trap.addEventListener('compositionend', (e) => {
      isComposing = false;
      if (activeMode === 'write') {
        const text = e.data;
        if (text) {
          for (let char of text) {
            triggerKeyAction(char);
          }
        }
      }
      trap.value = ''; // 清空捕获区
    });

    trap.addEventListener('input', (e) => {
      if (isComposing) return; // 正在输入拼音时不直接录入
      if (activeMode === 'write') {
        const data = e.data || trap.value;
        if (data) {
          for (let char of data) {
            // 避免回车在此处被二次录入
            if (char === '\n' || char === '\r') continue;
            triggerKeyAction(char);
          }
        }
      }
      trap.value = ''; // 保持清空以方便下一次录入
    });

    // 点击纸张或键盘区域时自动聚焦隐藏输入框，提升体验
    document.addEventListener('click', (e) => {
      if (activeMode === 'write') {
        // 如果点击的不是其他输入框，就聚焦到 trap 上
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          trap.focus();
        }
      }
    });
  }
}

// 触发按键动作：声音 + 录入
let activeMode = 'read'; // 'read' 或 'write'

function triggerKeyAction(keyChar) {
  // 播放打字机敲击声
  audioManager.playTypewriterKey();
  
  // 指针抖动
  newspaperReader.jiggleGauge();

  // 如果是在创作模式下，将字符录入到报纸纸张上
  if (activeMode === 'write') {
    insertCharToPaper(keyChar);
  }
}

// 在报纸上追加字符
function insertCharToPaper(char) {
  const contentContainer = document.getElementById('newspaper-content');
  if (!contentContainer) return;

  // 如果纸张是空的，或者之前是阅读内容，先清空
  if (contentContainer.querySelector('.lead-paragraph') && contentContainer.querySelectorAll('p').length > 1 && !contentContainer.classList.contains('user-draft')) {
    contentContainer.innerHTML = '';
    contentContainer.classList.add('user-draft');
  }

  // 保证有一个当前的草稿段落
  let activePara = contentContainer.querySelector('p.draft-p:last-of-type');
  if (!activePara) {
    activePara = document.createElement('p');
    activePara.className = 'draft-p lead-paragraph';
    contentContainer.appendChild(activePara);
  }

  // 插入光标处理
  let cursor = contentContainer.querySelector('.typewriter-cursor');
  if (!cursor) {
    cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    activePara.appendChild(cursor);
  }

  if (char === '\n') {
    // 换行，创建新段落
    cursor.remove();
    const newPara = document.createElement('p');
    newPara.className = 'draft-p';
    newPara.appendChild(cursor);
    contentContainer.appendChild(newPara);
  } else {
    // 判断是否为整篇文章的第一个字符
    const isFirstPara = activePara === contentContainer.querySelector('p.draft-p');
    const isFirstChar = activePara.childNodes.length === 1 && activePara.childNodes[0] === cursor;

    if (isFirstPara && isFirstChar) {
      const dropCapSpan = document.createElement('span');
      dropCapSpan.className = 'drop-cap';
      dropCapSpan.textContent = char;
      cursor.before(dropCapSpan);
    } else {
      // 录入普通字母/中文字符
      cursor.before(char);
    }
  }

  // 滚动条跟进
  newspaperReader.autoScrollToCursor(cursor);
}

// 物理删除纸张字符与回退换行段落
function deleteCharFromPaper() {
  const contentContainer = document.getElementById('newspaper-content');
  if (!contentContainer || activeMode !== 'write') return;

  const cursor = contentContainer.querySelector('.typewriter-cursor');
  if (!cursor) return;

  // 寻找光标前的兄弟节点
  const previousSibling = cursor.previousSibling;
  if (previousSibling) {
    if (previousSibling.nodeType === Node.TEXT_NODE) {
      const text = previousSibling.nodeValue;
      if (text.length > 0) {
        previousSibling.nodeValue = text.slice(0, -1);
      }
      // 如果文本节点内容已删空，立即将其从 DOM 中移去，方便下次删除前一个文本节点
      if (previousSibling.nodeValue.length === 0) {
        previousSibling.remove();
      }
    } else {
      previousSibling.remove();
    }
    // 播放打字机敲击声
    audioManager.playTypewriterKey();
    newspaperReader.jiggleGauge();
  } else {
    // 如果光标前没有任何内容，检查是否有上一个草稿段落，如果有，将光标移上去并删除空段落
    const parentPara = cursor.parentElement;
    if (parentPara && parentPara.classList.contains('draft-p')) {
      const prevPara = parentPara.previousElementSibling;
      if (prevPara && prevPara.classList.contains('draft-p')) {
        cursor.remove();
        prevPara.appendChild(cursor);
        parentPara.remove();
        
        audioManager.playTypewriterKey();
        newspaperReader.jiggleGauge();
      }
    }
  }
}


// 2. 剝始化台灯拉线开关 (明暗/夜间模式)
function initVintageLamp() {
  const pullCord = document.getElementById('lamp-pull-cord');
  if (!pullCord) return;

  // 创建开关拉动音效
  const playSwitchSound = () => {
    audioManager.init();
    const ctx = audioManager.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, time); // 较沉闷的机械啪哒声
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.05);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.07);
  };

  pullCord.addEventListener('click', () => {
    playSwitchSound();
    document.body.classList.toggle('lamp-off');
  });
}


// 3. 剝始化留声机与物理旋键阻尼调节
function initGramophone() {
  const record = document.getElementById('vinyl-record');
  const toneArm = document.getElementById('tone-arm');
  const light = document.getElementById('gramophone-light');
  
  if (!record || !toneArm || !light) return;

  const toggleGramophone = () => {
    audioManager.init();
    
    if (audioManager.isVinylPlaying) {
      // 停止
      audioManager.stopVinyl();
      record.classList.remove('playing');
      toneArm.classList.remove('playing');
      light.classList.remove('active');
    } else {
      // 播放
      audioManager.startVinyl();
      record.classList.add('playing');
      toneArm.classList.add('playing');
      light.classList.add('active');
    }
  };

  record.addEventListener('click', toggleGramophone);

  // 旋键旋转控制 (黑胶音量与雨声音量)
  setupKnob('knob-music', (val) => {
    audioManager.setVinylVolume(val);
  });
  setupKnob('knob-env', (val) => {
    audioManager.setRainVolume(val);
  });
}

// 辅助函数：旋键物理阻尼鼠标拖\u62拽旋转
function setupKnob(id, onChange) {
  const knob = document.getElementById(id);
  if (!knob) return;

  let isDragging = false;
  let startY = 0;
  let startValue = parseInt(knob.getAttribute('data-value') || '50');

  knob.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startValue = parseInt(knob.getAttribute('data-value') || '50');
    document.body.style.userSelect = 'none';
    audioManager.init();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // 垂直拖动计算旋转度数
    const deltaY = startY - e.clientY; // 彐上拉增大
    let newValue = startValue + Math.round(deltaY / 2); // 阻尼系数
    newValue = Math.max(0, Math.min(100, newValue)); // 限制 0-100

    knob.setAttribute('data-value', newValue);
    
    // 映射到旋转角度：0对应 -135deg，100对应 135deg
    const angle = -135 + (newValue / 100) * 270;
    knob.style.transform = `rotate(${angle}deg)`;

    onChange(newValue);
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = 'auto';
    }
  });

  // 剝始化旋转角度
  const initAngle = -135 + (startValue / 100) * 270;
  knob.style.transform = `rotate(${initAngle}deg)`;
}


// 4. 摩尔斯发报机与纸带打印
function initTelegraphWidget() {
  const key = document.getElementById('telegraph-key');
  const tape = document.getElementById('telegraph-tape');
  const playBtn = document.getElementById('btn-play-morse');
  const resetBtn = document.getElementById('btn-reset-morse');
  const input = document.getElementById('telegraph-input');
  
  if (!key || !tape || !playBtn || !input) return;

  let spaceTimer = null;

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      input.value = '';
      tape.textContent = '';
      if (spaceTimer) {
        clearTimeout(spaceTimer);
        spaceTimer = null;
      }
    });
  }

  // 手动按键事件
  key.addEventListener('mousedown', () => {
    key.classList.add('pressed');
    manualTelegraphKey.press();
    if (spaceTimer) {
      clearTimeout(spaceTimer);
      spaceTimer = null;
    }
  });

  window.addEventListener('mouseup', () => {
    if (key.classList.contains('pressed')) {
      key.classList.remove('pressed');
      const symbol = manualTelegraphKey.release();
      
      // 彐纸带上写字符
      if (symbol) {
        tape.textContent = (tape.textContent + symbol).slice(-40); // 增加保留长度以容纳更多手动输入的电码
        
        // 停顿 600ms 后自动补一个空格，以分割字母
        spaceTimer = setTimeout(() => {
          tape.textContent = (tape.textContent + ' ').slice(-40);
        }, 600);
      }
    }
  });

  // 输入框一键摩尔斯发报 / 纸带反向译电
  playBtn.addEventListener('click', async () => {
    let text = input.value.trim();
    
    // 如果输入框为空，尝试将纸带上的摩尔斯电码反向翻译到输入框中
    if (!text) {
      const morseOnTape = tape.textContent.trim();
      if (morseOnTape) {
        const translated = morseToText(morseOnTape);
        if (translated) {
          input.value = translated;
          text = translated;
        }
      }
      if (!text) return; // 如果依然为空，无法发报则返回
    }

    playBtn.disabled = true;
    playBtn.textContent = "发报中...";

    // 实时更新纸带
    tape.textContent = '';
    let currentMorseDisplay = '';

    await playMorseString(text, (isPressed, symbol) => {
      if (isPressed) {
        key.classList.add('pressed');
        currentMorseDisplay += symbol;
        tape.textContent = currentMorseDisplay.slice(-40);
      } else {
        key.classList.remove('pressed');
      }
    });

    playBtn.disabled = false;
    playBtn.textContent = "发报 (Play)";
  });
}


// 5. 模式切换、上一篁/下一篁、以及撕下电报导出图片
function initFooterAndModes() {
  const btnPrev = document.getElementById('btn-prev-article');
  const btnNext = document.getElementById('btn-next-article');
  const btnRip = document.getElementById('btn-rip-paper');
  
  const btnRead = document.getElementById('btn-mode-read');
  const btnWrite = document.getElementById('btn-mode-write');

  // 阅读文章切换
  btnPrev.addEventListener('click', () => {
    if (activeMode === 'write') {
      activeMode = 'read';
      btnRead.classList.add('active');
      btnWrite.classList.remove('active');
    }
    newspaperReader.prevArticle();
  });
  btnNext.addEventListener('click', () => {
    if (activeMode === 'write') {
      activeMode = 'read';
      btnRead.classList.add('active');
      btnWrite.classList.remove('active');
    }
    newspaperReader.nextArticle();
  });

  // 模式切换
  btnRead.addEventListener('click', () => {
    if (activeMode === 'read') return;
    activeMode = 'read';
    btnRead.classList.add('active');
    btnWrite.classList.remove('active');
    
    // 渲染回阅读文章
    newspaperReader.renderCurrentArticle();
  });

  btnWrite.addEventListener('click', () => {
    if (activeMode === 'write') return;
    activeMode = 'write';
    btnWrite.classList.add('active');
    btnRead.classList.remove('active');
    
    // 清空，准备用户自己打字
    newspaperReader.stopTyping();
    const content = document.getElementById('newspaper-content');
    content.innerHTML = '';
    content.classList.add('user-draft');
    
    // 创建上一个打字的光标
    const draftPara = document.createElement('p');
    draftPara.className = 'draft-p lead-paragraph';
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    draftPara.appendChild(cursor);
    content.appendChild(draftPara);

    // 自动聚焦到隐藏的中文输入捕获器上
    const trap = document.getElementById('chinese-input-trap');
    if (trap) {
      setTimeout(() => trap.focus(), 50);
    }
  });

  // 撕下电报，导出图片
  btnRip.addEventListener('click', () => {
    const paper = document.getElementById('vintage-paper');
    if (!paper) return;

    btnRip.textContent = "撕扯中...";
    btnRip.disabled = true;

    // 摭放摩擦嘶扯声
    audioManager.playPaperRip();

    // 延时讹声音摭放，并且保证渲染时带上滤镜
    paper.classList.add('export-mode'); // 规避 html2canvas 对 SVG 滤镜和 Grid 布局解析崩溃的 Bug
    
    setTimeout(() => {
      html2canvas(paper, {
        useCORS: true,
        backgroundColor: '#f6ecdc',
        scale: 2, // 提升清晰度
        logging: true
      }).then(canvas => {
        paper.classList.remove('export-mode');
        const link = document.createElement('a');
        link.download = `每日电报-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        btnRip.textContent = "撕下电报 (导出JPG)";
        btnRip.disabled = false;
      }).catch(err => {
        paper.classList.remove('export-mode');
        console.error("image save fail", err);
        btnRip.textContent = "撕下电报 (导出JPG)";
        btnRip.disabled = false;
      });
    }, 400);
  });
}


// 全局剝始化
window.addEventListener('DOMContentLoaded', () => {
  initTypewriterKeyboard();
  initVintageLamp();
  initGramophone();
  initTelegraphWidget();
  initStampSystem();
  initFooterAndModes();
  
  // 剝始化文章器
  newspaperReader.init();
});
