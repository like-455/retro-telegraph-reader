/* stamp.js - 红色油墨印章拖\u62拽与盖印逻辑 */
import audioManager from './audio.js';

export function initStampSystem() {
  const stampTools = document.querySelectorAll('.stamp-tool');
  const paper = document.getElementById('vintage-paper');
  const stampsContainer = document.getElementById('stamps-container');
  
  let activeStampType = null; // 当前处于“已选中准备盖下”的印章 (点击盖印模式)

  // 1. 剝始化印章的拖\u62拽(Drag)模式
  stampTools.forEach(tool => {
    tool.addEventListener('dragstart', (e) => {
      const stampType = tool.getAttribute('data-stamp');
      e.dataTransfer.setData('text/plain', stampType);
      tool.classList.add('dragging');
      audioManager.init(); // 确保音频上下文已初始化
    });

    tool.addEventListener('dragend', () => {
      tool.classList.remove('dragging');
    });

    // 2. 针对移动端或非键鼠拖\u62拽的“选择印章并点击盖印”模式
    tool.addEventListener('click', (e) => {
      e.stopPropagation();
      // 取消所有其他印章的选中状态
      stampTools.forEach(t => t.style.transform = 'none');
      
      const stampType = tool.getAttribute('data-stamp');
      if (activeStampType === stampType) {
        // 重复点击当前已选中印章，取消选中
        activeStampType = null;
        document.body.style.cursor = 'default';
      } else {
        activeStampType = stampType;
        // 选中的印章微向上提起，表示处于待盖印状态
        tool.style.transform = 'translateY(-10px) scale(1.05)';
        // 改变鼠标指针样式，提示用户可以在纸张上点击盖印
        document.body.style.cursor = 'crosshair';
      }
    });
  });

  // 3. 处理鼠标拖\u62拽落下盖印逻辑
  if (paper && stampsContainer) {
    paper.addEventListener('dragover', (e) => {
      e.preventDefault(); // 阻止浏览器默认拖\u62拽行为，充许 drop 事件触发
      e.dataTransfer.dropEffect = 'copy';
    });

    paper.addEventListener('drop', (e) => {
      e.preventDefault();
      const stampType = e.dataTransfer.getData('text/plain');
      if (!stampType) return;

      const rect = paper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      placeStamp(stampType, x, y, stampsContainer);
    });

    // 4. 支持通过点击印章后在纸面点击盖印
    paper.addEventListener('click', (e) => {
      if (!activeStampType) return;

      const rect = paper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      placeStamp(activeStampType, x, y, stampsContainer);

      // 成功盖印后，重置选中状态
      activeStampType = null;
      document.body.style.cursor = 'default';
      stampTools.forEach(t => t.style.transform = 'none');
    });
  }
}

/**
 * 在纸张指定坐标落下一个油墨印章
 */
function placeStamp(stampType, x, y, container) {
  const stampEl = document.createElement('div');
  stampEl.className = 'placed-stamp';
  
  // 根据印章绋型刅配印章上的中斌斌本
  let stampText = '已阅';
  if (stampType.includes('secret')) stampText = '机密';
  if (stampType.includes('urgent')) stampText = '特急';
  
  stampEl.textContent = stampText;

  // 随机倾斜度与位置微调，模拟所导盖印章的物理不均匀性
  const randomRotate = -10 - Math.random() * 15; // 倾斜范围限制在 -10deg 到 -25deg
  const randomShiftX = -5 + Math.random() * 10;
  const randomShiftY = -5 + Math.random() * 10;

  stampEl.style.left = `${x - 40 + randomShiftX}px`; // 40 像素为水平偏移修正值 (使盖印中心点对准鼠标点击处)
  stampEl.style.top = `${y - 20 + randomShiftY}px`;  // 20 像素为垂直偏移修正值
  stampEl.style.transform = `rotate(${randomRotate}deg) scale(0.95)`;
  
  // 添加盖印的雍力降落与油墨扩散物理动画
  stampEl.style.animation = 'stamp-impact 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';

  // 摭放清谆的木质敲击印泥盖章音效
  audioManager.playStampSound();

  // 在印章容器中添加该印章节点
  container.appendChild(stampEl);

  // 动态向页面写入关键幧动画样式 (若尚未创建)
  if (!document.getElementById('stamp-animation-keyframes')) {
    const style = document.createElement('style');
    style.id = 'stamp-animation-keyframes';
    style.textContent = `
      @keyframes stamp-impact {
        0% { transform: rotate(-30deg) scale(1.5); opacity: 0; filter: blur(2px) url(#stamp-grunge); }
        80% { transform: rotate(${randomRotate}deg) scale(0.95); opacity: 0.9; filter: url(#stamp-grunge); }
        100% { transform: rotate(${randomRotate}deg) scale(1); opacity: 1; filter: url(#stamp-grunge); }
      }
    `;
    document.head.appendChild(style);
  }
}
