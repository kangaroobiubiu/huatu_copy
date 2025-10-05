(function () {
    if (window.__HT_COPY_TOOL_INJECTED__) return;
    window.__HT_COPY_TOOL_INJECTED__ = true;

    /* --------- 基础工具函数 当前版本完美可使用，UI已美化 --------- */
    function $q(sel, root = document) { return root.querySelector(sel); }
    function $qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
    function trimText(el) { return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''; }
    function safeCopy(text) {
        if (!text) return Promise.resolve();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            return Promise.resolve();
        }
    }
    function cleanChoiceText(txt) { return txt.replace(/^[A-DＡ-Ｄ][\.\、\s]+/, '').trim(); }

    /* --------- 解析题目 --------- */
    function parseQuestion(node) {
        const id = node.getAttribute('data-id') || '';
        const index = node.getAttribute('data-question-index') || node.dataset.index || '';
        const mistake = node.getAttribute('data-mistake') === 'true' || node.dataset.mistake === 'true';
        const stem = trimText($q('.main-topic-stem', node)) || trimText($q('.topic-stem', node)) || trimText(node);

        const choiceEls = $qa('.main-topic-choices .main-topic-choice', node);
        const choices = choiceEls.length ? choiceEls.map((c, i) => {
            let txt = cleanChoiceText(c.innerText.trim());
            return `${String.fromCharCode(65 + i)}. ${txt}`;
        }) : [];

        const jiexiItems = $qa('.jiexi-items .jiexi-item', node).length
            ? $qa('.jiexi-items .jiexi-item', node)
            : $qa('.jiexi-item', node);

        let stat = '', analysis = '', points = '', source = '';
        jiexiItems.forEach(item => {
            const titleEl = $q('.jiexi-item-title', item);
            const contEl = $q('.jiexi-item-content', item);
            const title = titleEl ? titleEl.innerText.trim() : (item.getAttribute('data-title') || '');
            const content = contEl ? contEl.innerText.trim() : item.innerText.trim();
            if (/统计/.test(title)) stat = trimText(contEl) || trimText(item);
            else if (/解析/.test(title)) analysis = content;
            else if (/考点/.test(title)) {
                const pts = $qa('.jiexi-item-content', item).map(x => x.innerText.trim()).filter(Boolean);
                points = pts.join(' ; ') || content;
            } else if (/来源/.test(title)) source = content;
        });
        return { id, index: index || '(?)', mistake, stem, choices, stat, analysis, points, source, node };
    }

    function collectAllQuestions() {
        const qNodes = $qa('.exercise-main-topic');
        if (!qNodes.length) {
            const alt = $qa('.exercise-item, .exercise, .topic, .question');
            return alt.map(n => parseQuestion(n));
        }
        return qNodes.map(n => parseQuestion(n));
    }

    function buildTextForQuestion(q, modules) {
        const lines = [];
        if (modules.has('question')) {
            const stemText = q.stem.replace(/^\s*\d+\s*[、.．]\s*/, '').trim();
            lines.push(`${q.index}、 ${stemText}`);
            if (q.choices?.length) lines.push(...q.choices);
        }
        if (modules.has('stat') && q.stat) lines.push(`【统计】 ${q.stat}`);
        if (modules.has('analysis') && q.analysis) lines.push(`【解析】\n${q.analysis}`);
        if (modules.has('points') && q.points) lines.push(`【考点】 ${q.points}`);
        if (modules.has('source') && q.source) lines.push(`【来源】 ${q.source}`);
        return lines.join('\n');
    }

    /* --------- 创建面板 --------- */
    const panel = document.createElement('div');
    panel.id = 'ht-copy-panel';
    panel.innerHTML = `
      <div class="ht-panel-header">
        <strong>华图题目复制工具</strong>
        <div class="ht-panel-actions">
          <span id="ht-toggle-btn" title="折叠/展开">▾</span>
          <span id="ht-close-btn" title="关闭">✕</span>
        </div>
      </div>
      <div class="ht-panel-body">
        <div class="ht-modules">
          <label><input type="checkbox" data-mod="question" checked> 试题</label>
          <label><input type="checkbox" data-mod="stat" checked> 统计</label>
          <label><input type="checkbox" data-mod="analysis" checked> 解析</label>
          <label><input type="checkbox" data-mod="points" checked> 考点</label>
          <label><input type="checkbox" data-mod="source" checked> 来源</label>
        </div>
        <div class="ht-actions">
          <button id="ht-copy-all">复制所有题目</button>
          <button id="ht-copy-wrong">复制错题</button>
        </div>
        <div class="ht-question-list" id="ht-question-list"></div>
        <div class="ht-foot">提示：逐题或一键复制，支持选择模块。</div>
      </div>
    `;
    document.body.appendChild(panel);

    /* --------- 按钮行为 --------- */
    const body = panel.querySelector('.ht-panel-body');
    const toggleBtn = panel.querySelector('#ht-toggle-btn');
    document.getElementById('ht-close-btn').addEventListener('click', () => panel.remove());
    let collapsed = false;
    toggleBtn.addEventListener('click', () => {
        collapsed = !collapsed;
        if (collapsed) {
            body.style.display = 'none';
            toggleBtn.textContent = '▸';
        } else {
            body.style.display = 'block';
            toggleBtn.textContent = '▾';
        }
    });

    /* --------- 渲染题目列表 --------- */
    function renderQuestionList() {
        const qs = collectAllQuestions();
        const container = document.getElementById('ht-question-list');
        container.innerHTML = '';
        if (!qs.length) {
            container.innerHTML = '<div class="ht-empty">未找到题目</div>';
            return;
        }

        qs.forEach(q => {
            const row = document.createElement('div');
            row.className = 'ht-q-row';
            row.dataset.qid = q.id;
            row.innerHTML = `
              <div class="ht-q-left"><label><input type="checkbox" class="ht-q-select"> ${q.stem ? (q.stem.length > 100 ? q.stem.slice(0, 100) + '...' : q.stem) : '(无题干)'}</label></div>
              <div class="ht-q-right"><button class="ht-copy-this">复制此题</button></div>
            `;
            if (q.mistake) row.classList.add('ht-wrong');
            row.__q = q;
            container.appendChild(row);

            row.querySelector('.ht-copy-this').addEventListener('click', async () => {
                const modules = getSelectedModulesSet();
                const text = buildTextForQuestion(q, modules);
                await safeCopy(text);
                flashNotice('已复制此题');
            });
        });

        if (!document.getElementById('ht-copy-selected')) {
            const selBtn = document.createElement('button');
            selBtn.id = 'ht-copy-selected';
            selBtn.textContent = '复制所选题目';
            selBtn.style.marginTop = '8px';
            panel.querySelector('.ht-actions').appendChild(selBtn);
            selBtn.addEventListener('click', async () => {
                const rows = Array.from(document.querySelectorAll('#ht-question-list .ht-q-row'));
                const chosen = rows.filter(r => r.querySelector('.ht-q-select').checked).map(r => r.__q);
                await copySelectedQuestions(chosen);
            });
        }
    }

    function getSelectedModulesSet() {
        const checked = Array.from(panel.querySelectorAll('.ht-modules input:checked')).map(i => i.dataset.mod);
        return new Set(checked);
    }

    async function copySelectedQuestions(qsToCopy) {
        if (!qsToCopy?.length) return flashNotice('没有要复制的题目');
        const modules = getSelectedModulesSet();
        const texts = qsToCopy.map(q => buildTextForQuestion(q, modules));
        const joined = texts.join('\n\n' + '-'.repeat(20) + '\n\n');
        await safeCopy(joined);
        flashNotice(`已复制 ${qsToCopy.length} 道题`);
    }

    document.getElementById('ht-copy-all').addEventListener('click', async () => {
        const qs = collectAllQuestions();
        await copySelectedQuestions(qs);
    });
    document.getElementById('ht-copy-wrong').addEventListener('click', async () => {
        const qs = collectAllQuestions().filter(q => q.mistake);
        await copySelectedQuestions(qs);
    });

    /* --------- 提示框 --------- */
    function flashNotice(msg, timeout = 600) {
        let n = document.getElementById('ht-notice');
        if (!n) {
            n = document.createElement('div');
            n.id = 'ht-notice';
            document.body.appendChild(n);
        }
        n.innerText = msg;
        n.classList.add('show');
        setTimeout(() => n.classList.remove('show'), timeout);
    }

    /* --------- 样式优化 --------- */
    const style = document.createElement('style');
    style.textContent = `
    .ht-panel {
  position: fixed;
  top: 100px;
  right: 100px;
  width: 380px;
  min-height: 200px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  font-family: "Segoe UI", "Microsoft Yahei", sans-serif;
  font-size: 14px;
  color: #333;
  z-index: 99999;
  resize: both;
  overflow: auto;
}

/* 标题栏 */
.ht-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9f9f9;
  border-bottom: 1px solid #e5e5e5;
  padding: 6px 10px;
  border-radius: 10px 10px 0 0;
  cursor: move;
  user-select: none;
}

/* 标题文字 */
.ht-panel-header strong {
  font-weight: 600;
  color: #333;
}

/* 折叠、关闭按钮 */
.ht-panel-actions {
  display: flex;
  align-items: center;
  gap: 6px; /* ✅ 调整按钮间距 */
}
.ht-panel-actions span {
  display: inline-block;
  background: #f1f1f1;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background 0.2s;
}
.ht-panel-actions span:hover {
  background: #e0e0e0;
}

/* 模块选择区 */
.ht-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

/* 操作按钮区（三个按钮都在这） */
.ht-actions {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

/* ✅ 统一按钮样式 */
.ht-actions button {
  flex: 1;
  min-width: 100px;
  padding: 8px 0;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #f8f8f8;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
}
.ht-actions button:hover {
  background: #e6e6e6;
}

/* ✅ 主按钮（复制所有题目） */
#ht-copy-all {
  background: #007bff;
  border-color: #007bff;
  color: #fff;
}
#ht-copy-all:hover {
  background: #0069d9;
}

/* ✅ 每题行 */
.ht-q-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #eee;
}
.ht-q-row:hover {
  background: #f9f9f9;
}
.ht-q-right button {
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f8f8f8;
  padding: 4px 8px;
  cursor: pointer;
}
.ht-q-right button:hover {
  background: #e6e6e6;
}

/* ✅ 错题高亮 */
.ht-wrong {
  background: #fff6f6;
}

/* 提示框 */
#ht-notice {
  position: fixed;
  top: 30%;
  left: 50%;
  background: #333;
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  opacity: 0;
  // transform: translateX(-50%);
  // transition: opacity 0.3s;
  transform: translate(-50%, -50%) scale(0.96);
  transition: opacity 0.25s ease, transform 0.25s ease;
  z-index: 100000;
  
  max-width: 300px;        /* 最大宽度限制，避免太宽 */
  white-space: normal;     /* 允许换行 */
  text-align: center;      /* 居中文本 */
  box-sizing: border-box;
  word-wrap: break-word;   /* 内容超长自动换行 */
  
  
}
#ht-notice.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

    `;
    document.head.appendChild(style);

    /* --------- 监听变化 --------- */
    let lastCount = 0;
    function safeRender() {
        const qs = collectAllQuestions();
        if (qs.length === lastCount) return;
        lastCount = qs.length;
        renderQuestionList();
    }
    const obs = new MutationObserver(() => {
        if (window.__ht_render_timer) clearTimeout(window.__ht_render_timer);
        window.__ht_render_timer = setTimeout(() => safeRender(), 600);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    renderQuestionList();
})();
