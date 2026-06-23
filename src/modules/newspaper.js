/* newspaper.js - 复古报纸排版、逐字物理打字与文章渲染逻辑 */
import audioManager from './audio.js';

// 内置的复古文章数据集（如果加载不到今日简报，或者作为后备文章）
const VINTAGE_ARTICLES = [
  {
    title: "今日简报：天下大事纵览",
    date: "正在联络电台...",
    issue: "最新号",
    content: [
      "正在通过电报接收最新的今日简报，请稍候...",
      "若长时间没有响应，请检查网络联络是否畅通。"
    ]
  },
  {
    title: "泰坦尼克号无线电求救电码",
    date: "中华民国元年 · 四月卅五日",
    issue: "第 012 期",
    content: [
      "【大西洋电】杌报特讯：昨夜子时，号称「永不沉没」为蒸汽巨轮——泰坦尼克号（Titanic）于北大西洋纽芬兰以南遭逢巨大冰山撞击，船身破裂，海水涌入，局势万分危急。",
      "该轮发报员菲利普斯（Jack Phillips）在寒夜中坚守发报室，疯狂拉动发报电键，向周围海域发出了历史上第一批「CQD」与「SOS」摩尔斯求救信号：",
      "「SOS SOS CQD CQD - MGY - WE ARE SINKING FAST - PASSENGERS BEING PUT INTO BOATS - TITANIC」",
      "滴滴滴、答答答、滴滴滴。寒冷的电波在夜空中震颤。机械的敲击声是这场灾难中最后的希望之光。然而，微弱的火花终究未能阻挡巨轮的下沉。至今日黎明，冰冷的大洋已将其吞噬。蒸汽时代的伟大奇迹，终成海底的机械铁骨。"
    ]
  },
  {
    title: "申报社论：蒸汽机囮与民心启蒙",
    date: "清光绪三十十四章 · 八月廿四日",
    issue: "第 035 期",
    content: [
      "【申报】西国之富强，非徒峕枪炮丫利，实源于求汽机械之日新月异。自瓦特改良蒸汽机，轮轮铁路纵横万里，织布熔铁力抵万夫。西人以机械代人力，民富国强，其势如大江东去，不可遏抑。",
      "反观我国，士大夫多鄙夷机械为「奇技浛巧」，墨守成规，不思变革。殊不知机械者，格致主实效，天理之体现也。齿轮啮合，蒸汽腾涌，皆有定规，无半点虚妄。",
      "交日特刊此文，冀望国人明晰机械为理. 当听汽笛长鸣、钢铁轰鸣之时，能省思启蒙，力行实业。苟能如此，则铁轨所及之处，並即文明开化为所也。"
    ]
  },
  {
    title: "雷明顿打字机与机械书写史",
    date: "公元一九二六年 · 六月廿二日",
    issue: "第 078 期",
    content: [
      "【纽约讯】今日是萧尔斯（Christopher Sholes）发明实用打字机并由雷明顿（Remington）工厅量产之五十周年绋念。此一小巧绎致主钢铁造物，辻底重塑了人类文字之书写型态。",
      "打字机之美，在于其极致的物理啮合：当手指按下一枚刻有字母的圆形按键，连杆拉动，重逾半磅 of 钢制字锤随之弹起，猛烈撞击色带，在白纸上烙下深黑的铅字。此一次敲击都是一次力的爆发，伴随着「啪嗒」的干脆声响。",
      "当字行已满，铃声「叮」然鸣响，推回拉杆，滚筒滚动，一行新的空纸面再度呈现。这种充满节奏与机械反馈的书方式，让无数文人墨客为一着迷。钢铁的冷酷与墨香的温存，在此完美交融。"
    ]
  }
];

class NewspaperReader {
  constructor() {
    this.articles = VINTAGE_ARTICLES;
    this.currentIndex = 0;
    
    this.paperElement = null;
    this.contentContainer = null;
    this.scrollerElement = null;
    this.gaugePointer = null;
    
    this.isTyping = false;
    this.typeSpeedMode = true; // true: 巴字打印, false: 瞬间排印
    this.typingTimer = null;
  }

  async init() {
    this.paperElement = document.getElementById('vintage-paper');
    this.contentContainer = document.getElementById('newspaper-content');
    this.scrollerElement = document.getElementById('paper-scroller');
    this.gaugePointer = document.getElementById('gauge-pointer');
    
    // 渲染骨架
    this.renderCurrentArticle();

    // 异步拉取今日简报
    await this.fetchTodayNews();
  }

  async fetchTodayNews() {
    try {
      // 备选国内无需 key 且支持跨域的公共接口
      const res = await fetch('https://60s.viki.moe/v2/60s');
      const json = await res.json();
      if (json && json.code === 200 && json.data) {
        const newsData = json.data;
        
        // 将新闻分组映射为包含多条内容的长文章，丰富每页纸张的阅读体验
        const mappedArticles = [];
        const itemsPerPage = 5;
        for (let i = 0; i < newsData.news.length; i += itemsPerPage) {
          const chunk = newsData.news.slice(i, i + itemsPerPage);
          const pageNum = Math.floor(i / itemsPerPage) + 1;
          
          const content = [
            `【综合电讯】今日海内外要闻荟萃（第 ${pageNum} 辑）：`
          ];
          
          chunk.forEach((item, chunkIdx) => {
            content.push(`（${i + chunkIdx + 1}）${item}`);
          });
          
          // 只在每一辑的最后附上格言
          content.push(`【格言联璧】${newsData.tip || "日日新，又日新。"}`);

          mappedArticles.push({
            title: `今日电讯 · 第 ${pageNum} 辑`,
            date: newsData.date + " · " + (newsData.day_of_week || "") + " · " + (newsData.lunar_date || ""),
            issue: "新电 " + newsData.date.replace(/-/g, "") + ` - 0${pageNum}`,
            content: content
          });
        }

        // 替换掉首个占位文章，并在前面插入这些今日要闻
        // 原始后备的泰坦尼克号、申报、雷明顿则接在后面
        const originalVintage = VINTAGE_ARTICLES.slice(1);
        this.articles = [...mappedArticles, ...originalVintage];

        // 重新刷新渲染当前的第一篇
        this.renderCurrentArticle();
      }
    } catch (e) {
      console.warn("无法联络最新新闻电讯，已自动加载离线简报数据", e);
      // 降级使用多篇离线新闻简报
      const offlineNews = [
        "蒸汽动力计算仪已在多个大城市投入实验性使用，极大提升了工厂与商业账簿核算之效率。",
        "跨大西洋海底电缆传输速率成功提升至每分钟二十个字符，标志着全球即时通讯进入新纪元。",
        "飞艇环球旅行线路于本周正式面向公众开放预订，首发班次客满，广受欢迎。",
        "机械打字机防滑复古键帽专利在今日获得批准，新型凹面按键更契合指尖生理弧度。"
      ];

      const mappedArticles = offlineNews.map((item, index) => {
        return {
          title: `复古离线要闻 (${index + 1})`,
          date: "大正九年 · 闰十月",
          issue: `离线版 ${index + 1} 号`,
          content: [
            `【无线电后备译电】第 ${index + 1} 号备用电文：`,
            item,
            "【格言】保持专注与笃定，不受外界尘嚣干扰。"
          ]
        };
      });

      const originalVintage = VINTAGE_ARTICLES.slice(1);
      this.articles = [...mappedArticles, ...originalVintage];

      this.renderCurrentArticle();
    }
  }

  // 渲染当前选中的文章
  async renderCurrentArticle() {
    // 停止之前的打字进度
    this.stopTyping();

    // 摭放拉纸摩擦声
    audioManager.playPaperRip();

    // 重置报纸内容与印章
    this.contentContainer.innerHTML = '';
    const stampsContainer = document.getElementById('stamps-container');
    if (stampsContainer) stampsContainer.innerHTML = '';

    const article = this.articles[this.currentIndex];
    
    // 更新报头元数据
    document.getElementById('newspaper-date').textContent = article.date;
    document.getElementById('newspaper-issue').textContent = article.issue;

    // 清理滚动条到最上方
    this.scrollerElement.scrollTop = 0;

    // 添加纸面颤抖动画
    this.paperElement.style.animation = 'none';
    // 触发浏览器重绘以重新应用动画
    this.paperElement.offsetHeight; 
    this.paperElement.style.animation = 'paper-insert 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

    if (this.typeSpeedMode) {
      // 逐步打印模式
      await this.typeArticle(article);
    } else {
      // 瞬间排印模式
      this.instantRender(article);
    }
  }

  // 瞬间渲染文章
  instantRender(article) {
    let html = '';
    article.content.forEach((para, idx) => {
      const isFirst = idx === 0;
      if (isFirst && para.length > 0) {
        const firstChar = para[0];
        const restText = para.slice(1);
        html += '<p class="lead-paragraph"><span class="drop-cap">' + firstChar + '</span>' + restText + '</p>';
      } else {
        html += '<p>' + para + '</p>';
      }
    });
    // 放入双栏报纸容器中
    this.contentContainer.innerHTML = html;
    
    // 指针回零
    if (this.gaugePointer) {
      this.gaugePointer.style.transform = 'rotate(-60deg)';
    }
  }

  // 逐字打字机打印效果
  typeArticle(article) {
    this.isTyping = true;
    
    // 构造段落的骨架（空的段落节点）
    const paragraphs = [];
    article.content.forEach((para, idx) => {
      const p = document.createElement('p');
      if (idx === 0) p.className = 'lead-paragraph';
      this.contentContainer.appendChild(p);
      paragraphs.push({
        element: p,
        fullText: para,
        currentCharIndex: 0
      });
    });

    let currentParaIdx = 0;
    
    // 插入打字机光标
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';

    const typeNextChar = () => {
      if (!this.isTyping) return;

      if (currentParaIdx >= paragraphs.length) {
        // 全部打印完毕，结束打字
        this.stopTyping();
        return;
      }

      const pObj = paragraphs[currentParaIdx];
      const pEl = pObj.element;
      
      // 确保光标附在当前段落尾部
      if (cursor.parentNode !== pEl) {
        pEl.appendChild(cursor);
      }

      if (pObj.currentCharIndex < pObj.fullText.length) {
        const char = pObj.fullText[pObj.currentCharIndex];
        
        // 如果是首段落的首个字符，使用 drop-cap 包装
        if (currentParaIdx === 0 && pObj.currentCharIndex === 0) {
          const dropCapSpan = document.createElement('span');
          dropCapSpan.className = 'drop-cap';
          dropCapSpan.textContent = char;
          cursor.before(dropCapSpan);
        } else {
          // 在光标前插入普通字符
          cursor.before(char);
        }
        
        pObj.currentCharIndex++;

        // 摭放打字机敲击声
        audioManager.playTypewriterKey();

        // 模拟打字速率指针抖动
        this.jiggleGauge();

        // 滚动条随文字跟进：如果光标高度接还或超出滚动区下沿，自动向下卷滚
        this.autoScrollToCursor(cursor);

        // 随机的打字间隔，模拟真人打字起伏
        const typingDelay = 55 + Math.random() * 80;
        this.typingTimer = setTimeout(typeNextChar, typingDelay);
      } else {
        // 本段落结束，换行
        audioManager.playTypewriterBell(); // 换行叮声
        
        // 给纸张来一个轛微的换行物理震动
        this.jigglePaper();

        currentParaIdx++;
        // 延迟长一点再打下一段 (回车拉杆耗时)
        this.typingTimer = setTimeout(typeNextChar, 500);
      }
    };

    // 启动打印进度
    typeNextChar();
  }

  stopTyping() {
    this.isTyping = false;
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    // 移除光标
    const cursor = document.querySelector('.typewriter-cursor');
    if (cursor) cursor.remove();
    
    // 指针复位
    if (this.gaugePointer) {
      this.gaugePointer.style.transform = 'rotate(-60deg)';
    }
  }

  // 让打字速率仪表盘指针抖动
  jiggleGauge() {
    if (!this.gaugePointer) return;
    // 映射当前打字犋态的指针角度（活跃打字时在 -10deg 到 40deg 间抖动）
    const randomAngle = -10 + Math.random() * 50;
    this.paperElement.offsetHeight; // force reflow
    this.gaugePointer.style.transform = 'rotate(' + randomAngle + 'deg)';
  }

  // 换行时震动纸张
  jigglePaper() {
    if (!this.paperElement) return;
    this.paperElement.style.transform = 'translateY(-4px)';
    setTimeout(() => {
      this.paperElement.style.transform = 'translateY(0)';
    }, 100);
  }

  // 自动将滚动条滑向打印中的光标
  autoScrollToCursor(cursorEl) {
    if (!this.scrollerElement || !cursorEl) return;
    
    const scrollerRect = this.scrollerElement.getBoundingClientRect();
    const cursorRect = cursorEl.getBoundingClientRect();
    
    // 如果光标接近底部 70px 范围内，就向下沿滚动
    const offsetBottom = scrollerRect.bottom - cursorRect.bottom;
    if (offsetBottom < 75) {
      this.scrollerElement.scrollTop += (75 - offsetBottom);
    }
  }

  // 切换上一篁/下一篁文章
  prevArticle() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentArticle();
    }
  }

  nextArticle() {
    if (this.currentIndex < this.articles.length - 1) {
      this.currentIndex++;
      this.renderCurrentArticle();
    }
  }
}

export const newspaperReader = new NewspaperReader();
export default newspaperReader;
