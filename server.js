
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.send('STORM GHOST V33.6 ACTIVE');
});

app.post('/scan', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const blocks = [];
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 50) || "Zero Block Content";
            blocks.push({ id, description: preview, type: '396' });
        });
        res.json({ success: true, blocks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tilda/', async (req, res) => {
    const { url, blockIds } = req.body;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);
        const designs = [];
        
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            if (blockIds && !blockIds.includes(id)) return;
            
            const ab = $(rec).find('.t396__artboard');
            if (!ab.length) return;
            
            const design = { elements: {} };
            // Собираем параметры артборда
            Object.keys(ab[0].attribs).forEach(a => {
                if (a.startsWith('data-artboard-')) design[a.replace('data-artboard-', '')] = ab[0].attribs[a];
            });
            
            // Собираем элементы
            $(rec).find('.tn-elem').each((__, el) => {
                const eid = $(el).attr('data-elem-id');
                const element = { id: eid, type: $(el).attr('data-elem-type') || 'text' };
                Object.keys(el.attribs).forEach(a => {
                    if (a.startsWith('data-field-')) element[a.replace('data-field-', '').replace('-value', '')] = el.attribs[a];
                });
                const atom = $(el).find('.tn-atom');
                if (element.type === 'text') {
                    element.text = atom.html();
                } else {
                    const img = atom.attr('data-original') || $(el).find('img').attr('src');
                    if (img) element.img = img;
                }
                design.elements[eid] = element;
            });
            designs.push(design);
        });

        // ИНЪЕКЦИОННАЯ ЛОГИКА (БЕЗ ПРОВЕРОК, ТОЛЬКО ДЕЙСТВИЕ)
        const ghostCode = `
(async () => {
    const log = (m) => console.log("%c" + m, "color:#fff;background:#fa8669;padding:3px 10px;border-radius:5px;font-weight:bold;");
    const designs = ${JSON.stringify(designs)};
    
    function getTildaData() {
        const w = [window, window.parent, window.top];
        let p = null, t = null;
        for (let target of w) {
            try {
                p = p || target.pageid || target.all_records_data?.pageid;
                t = t || target.token || target.formstoken || target.td_token || target.all_records_data?.token;
            } catch(e) {}
        }
        p = p || new URLSearchParams(window.location.search).get('pageid') || document.querySelector('#allrecords')?.dataset?.tildaPageId;
        t = t || document.querySelector('input[name="token"]')?.value || document.querySelector('#allrecords')?.getAttribute('data-tilda-formskey');
        return { p, t };
    }

    const { p, t } = getTildaData();
    if (!p || !t) {
        log("❌ СЕССИЯ НЕ НАЙДЕНА. ОТКРОЙТЕ РЕДАКТОР СТРАНИЦЫ.");
        return;
    }

    log("🚀 GHOST CLONER: Начинаю импорт " + designs.length + " блоков...");

    for (let i = 0; i < designs.length; i++) {
        try {
            // 1. Создаем пустой Zero Block
            const res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: "comm=addblock&pageid=" + p + "&type=396&token=" + t
            }).then(r => r.json());

            if (res && res.recordid) {
                const d = designs[i];
                d.artboard_id = res.recordid;
                d.recid = res.recordid;
                d.pageid = p;
                
                // 2. Сохраняем в него наш дизайн
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: "comm=save&pageid=" + p + "&recordid=" + res.recordid + "&token=" + t + "&data=" + encodeURIComponent(JSON.stringify(d))
                });
                console.log("Ghost: Блок " + (i+1) + " готов.");
            }
        } catch (e) { console.error("Ghost Error:", e); }
    }
    
    log("✅ УСПЕХ! ОБНОВЛЯЮ СТРАНИЦУ...");
    setTimeout(() => { window.top.location.reload(); }, 500);
})();`.trim();

        const encoded = Buffer.from(unescape(encodeURIComponent(ghostCode))).toString('base64');
        res.json({ src: encoded });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Ghost Node V33.6 Running...'));
