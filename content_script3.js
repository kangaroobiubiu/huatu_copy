// content_script.js  完美可使用的版本
(function () {
    if (window.__HT_COPY_TOOL_INJECTED__) return;
    window.__HT_COPY_TOOL_INJECTED__ = true;

    /* --------- 基础工具函数 --------- */
    function $q(sel, root = document) { return root.querySelector(sel); }
    function $qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
    function trimText(el) {
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    }
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

    // 清洗选项文字，去掉重复 A. / B. 前缀
    function cleanChoiceText(txt) {
        return txt.replace(/^[A-DＡ-Ｄ][\.\、\s]+/, '').trim();
    }

    /* --------- 解析每道题 --------- */
    function parseQuestion(node) {
        const id = node.getAttribute('data-id') || '';
        const index = node.getAttribute('data-question-index') || node.getAttribute('data-index') || node.dataset.index || '';
        const mistake = node.getAttribute('data-mistake') === 'true' || node.dataset.mistake === 'true';
        const stem = trimText($q('.main-topic-stem', node)) || trimText($q('.topic-stem', node)) || trimText(node);

        // 选项处理：去除重复 A. A.
        const choiceEls = $qa('.main-topic-choices .main-topic-choice', node);
        const choices = choiceEls.length ? choiceEls.map((c, i) => {
            let txt = cleanChoiceText(c.innerText.trim());
            return `${String.fromCharCode(65 + i)}. ${txt}`;
        }) : [];

        // 解析项（统计、解析、考点、来源）
        const jiexiItems = $qa('.jiexi-items .jiexi-item', node).length
            ? $qa('.jiexi-items .jiexi-item', node)
            : $qa('.jiexi-item', node);

        let stat = '', analysis = '', points = '', source = '';
        jiexiItems.forEach(item => {
            const titleEl = $q('.jiexi-item-title', item);
            const contEl = $q('.jiexi-item-content', item);
            const title = titleEl ? titleEl.innerText.trim() : (item.getAttribute('data-title') || '');
            const content = contEl ? contEl.innerText.trim() : item.innerText.trim();

            // if (/统计/.test(title)) stat = content;
            if (/统计/.test(title)) stat = trimText(contEl) || trimText(item);
            else if (/解析/.test(title)) analysis = content;
            else if (/考点/.test(title)) {
                const pts = $qa('.jiexi-item-content', item).map(x => x.innerText.trim()).filter(Boolean);
                points = pts.join(' ; ') || content;
            }
            else if (/来源/.test(title)) source = content;
        });

        return { id, index: index || '(?)', mistake, stem, choices, stat, analysis, points, source, node };
    }

    /* --------- 收集所有题目节点 --------- */
    function collectAllQuestions() {
        const qNodes = $qa('.exercise-main-topic');
        if (!qNodes.length) {
            const alt = $qa('.exercise-item, .exercise, .topic, .question');
            return alt.map(n => parseQuestion(n));
        }
        return qNodes.map(n => parseQuestion(n));
    }

    /* --------- 构建题目文本 --------- */
    function buildTextForQuestion(q, modules) {
        const lines = [];
        if (modules.has('question')) {
            // 去掉题干中自带编号
            const stemText = q.stem.replace(/^\s*\d+\s*[、.．]\s*/, '').trim();
            lines.push(`${q.index}、 ${stemText}`);
            if (q.choices && q.choices.length) lines.push(...q.choices);
        }
        if (modules.has('stat') && q.stat) lines.push(`【统计】 ${q.stat}`);
        if (modules.has('analysis') && q.analysis) lines.push(`【解析】\n${q.analysis}`);
        if (modules.has('points') && q.points) lines.push(`【考点】 ${q.points}`);
        if (modules.has('source') && q.source) lines.push(`【来源】 ${q.source}`);
        return lines.join('\n');
    }

    /* --------- UI 面板 --------- */
    const panel = document.createElement('div');
    panel.id = 'ht-copy-panel';
    panel.innerHTML = `
    <div class="ht-panel-header">
      <strong>华图题目复制工具</strong>
      <span id="ht-close-btn" title="关闭">✕</span>
    </div>
    <div class="ht-panel-body">
      <div class="ht-modules">
        <label><input type="checkbox" data-mod="question" checked> 试题（题干 + 选项）</label>
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

    document.getElementById('ht-close-btn').addEventListener('click', () => panel.remove());

    /* --------- 渲染题目列表 --------- */
    function renderQuestionList() {
        const qs = collectAllQuestions();
        const container = document.getElementById('ht-question-list');
        container.innerHTML = '';
        if (!qs.length) {
            container.innerHTML = '<div class="ht-empty">未找到题目（请在含试题解析的页面使用）</div>';
            return;
        }


        //  <div class="ht-q-left"><label><input type="checkbox" class="ht-q-select"> ${q.index}、 ${q.stem ? (q.stem.length>100? q.stem.slice(0,100)+'...': q.stem) : '(无题干)'}</label></div>

        qs.forEach(q => {
            const row = document.createElement('div');
            row.className = 'ht-q-row';
            row.dataset.qid = q.id;
            row.innerHTML = `
        <div class="ht-q-left"><label><input type="checkbox" class="ht-q-select"> ${q.stem ? (q.stem.length>100? q.stem.slice(0,100)+'...': q.stem) : '(无题干)'}</label></div>
        <div class="ht-q-right">
          <button class="ht-copy-this">复制此题</button>
        </div>
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
        const checked = Array.from(panel.querySelectorAll('.ht-modules input[type="checkbox"]:checked'))
            .map(i => i.dataset.mod);
        return new Set(checked);
    }

    async function copySelectedQuestions(qsToCopy) {
        if (!qsToCopy || !qsToCopy.length) { flashNotice('没有要复制的题目'); return; }
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

    /* --------- 提示信息 --------- */
    function flashNotice(msg, timeout = 1600) {
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

    // /* --------- 自动检测页面变化(无法勾选，弃用) --------- */
    // const obs = new MutationObserver(() => {
    //     if (window.__ht_render_timer) clearTimeout(window.__ht_render_timer);
    //     window.__ht_render_timer = setTimeout(() => renderQuestionList(), 300);
    // });
    // obs.observe(document.body, { childList: true, subtree: true });
    //
    // renderQuestionList();

    // 保存已勾选题目的 ID
    let lastQuestionCount = 0;

    function safeRenderQuestionList() {
        const qs = collectAllQuestions();
        // 如果题目数量没变化，不刷新（防止用户勾选被清空）
        if (qs.length === lastQuestionCount) return;
        lastQuestionCount = qs.length;
        renderQuestionList();
    }

// 监听页面变化（仅当题目数量变化时刷新）
    const obs = new MutationObserver(() => {
        if (window.__ht_render_timer) clearTimeout(window.__ht_render_timer);
        window.__ht_render_timer = setTimeout(() => safeRenderQuestionList(), 600);
    });
    obs.observe(document.body, { childList: true, subtree: true });

// 首次渲染
    renderQuestionList();





    window.__ht_copy_tool = { collectAllQuestions, buildTextForQuestion };

})();
