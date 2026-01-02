
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`
        <div style="font-family: sans-serif; text-align:center; padding: 100px 20px; background: #020617; min-height: 100vh; color: white;">
            <div style="background: #0f172a; display: inline-block; padding: 50px; border: 1px solid #1e293b; border-radius: 40px; box-shadow: 0 25px 50px -12px rgba(249, 115, 22, 0.2);">
                <h1 style="color:#fa8669; font-size: 48px; margin-bottom: 10px; font-weight: 900;">STORM GHOST V33.8</h1>
                <p style="color:#22c55e; font-size: 18px; font-weight: bold; letter-spacing: 2px;">HYBRID INJECTION ACTIVE</p>
                <div style="margin-top: 30px; color: #64748b; font-size: 12px; font-family: monospace;">CLONE-TO-ACCOUNT OR GHOST-RENDER</div>
            </div>
        </div>
    `);
});

app.post('/scan', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const blocks = [];
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 60) || "Zero Block Layer";
            blocks.push({ id, description: preview, type: '396' });
        });
        res.json({ success: true, blocks, total: blocks.length });
    } catch (err) {
        res.status(500).json({ error: 'Proxy Error: ' + err.message });
    }
});

app.post('/tilda', async (req, res) => {
    const { url, blockIds } = req.body;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);
        
        const rawBlocks = [];
        const designs = [];
        
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            if (blockIds && !blockIds.includes(id)) return;
            
            // Собираем HTML и стили для визуальной инъекции (Ghost Mode)
            rawBlocks.push({
                html: $(rec).prop('outerHTML'),
                id: id
            });

            // Собираем данные для клонирования в редактор (Editor Mode)
            const ab = $(rec).find('.t396__artboard');
            if (!ab.length) return;
            const design = { elements: {} };
            Object.keys(ab[0].attribs).forEach(a => {
                if (a.startsWith('data-artboard-')) design[a.replace('data-artboard-', '')] = ab[0].attribs[a];
            });
            $(rec).find('.tn-elem').each((__, el) => {
                const eid = $(el).attr('data-elem-id');
                const element = { id: eid, type: $(el).attr('data-elem-type') || 'text' };
                Object.keys(el.attribs).forEach(a => {
                    if (a.startsWith('data-field-')) element[a.replace('data-field-', '').replace('-value', '')] = el.attribs[a];
                });
                const atom = $(el).find('.tn-atom');
                if (element.type === 'text') element.text = atom.html();
                else {
                    const img = atom.attr('data-original') || $(el).find('img').attr('src');
                    if (img) element.img = img;
                }
                design.elements[eid] = element;
            });
            designs.push(design);
        });

        // Универсальный инъектор
        const injectScript = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    const rawBlocks = ${JSON.stringify(rawBlocks)};
    
    const findSession = () => {
        const w = window, p = window.parent;
        let pageId = w.td?.pageId || p.td?.pageId || w.pageid || p.pageid || (document.querySelector('#allrecords') || p.document?.querySelector('#allrecords'))?.getAttribute('data-tilda-page-id');
        let token = w.td?.token || p.td?.token || w.token || p.token || w.formstoken || p.formstoken || (document.querySelector('input[name="token"]') || p.document?.querySelector('input[name="token"]'))?.value || (document.querySelector('#allrecords') || p.document?.querySelector('#allrecords'))?.getAttribute('data-tilda-formskey');
        return { pageId, token };
    };

    const { pageId, token } = findSession();

    // Если мы НЕ в редакторе (нет токена), делаем GHOST RENDER
    if (!token || !pageId) {
        console.log("%c STORM GHOST %c GHOST MODE: Визуальная инъекция в DOM", "color:#fff;background:#000;padding:4px;", "color:#fff;background:#22c55e;padding:4px;");
        const container = document.querySelector('#allrecords') || document.body;
        rawBlocks.forEach(b => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = b.html;
            container.appendChild(wrapper.firstChild);
        });
        
        // Переинициализация Tilda Zero (если скрипты Tilda на странице есть)
        if (window.t396_init) {
            rawBlocks.forEach(b => {
                const id = b.id.replace('rec', '');
                try { window.t396_init(id); } catch(e){}
            });
        }
        
        alert("STORM GHOST: Блоки внедрены визуально (Ghost Mode). Для полноценного клонирования в аккаунт используйте консоль в редакторе страницы.");
        return;
    }

    // Если мы В РЕДАКТОРЕ, делаем CLONE
    console.log("%c STORM GHOST %c CLONE MODE: Сохранение в редактор", "color:#fff;background:#000;padding:4px;", "color:#fff;background:#fa8669;padding:4px;");

    for (let i = 0; i < designs.length; i++) {
        const data = designs[i];
        try {
            const res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({ comm: 'addblock', pageid: pageId, type: '396', token: token })
            }).then(r => r.json());

            if (res && res.recordid) {
                data.artboard_id = res.recordid;
                data.recid = res.recordid;
                data.pageid = pageId;
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: new URLSearchParams({ comm: 'save', pageid: pageId, recordid: res.recordid, token: token, data: JSON.stringify(data) })
                });
            }
        } catch (e) {
            console.error("Clone Error:", e);
        }
    }
    
    alert("STORM GHOST: Успешно клонировано " + designs.length + " блоков!");
    if (window.parent && window.parent !== window) window.parent.location.reload();
    else window.location.reload();
})();`.trim();

        const src = Buffer.from(injectScript, 'utf-8').toString('base64');
        res.json({ src });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ghost Server running on ${PORT}`));
