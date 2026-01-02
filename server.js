
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
            <div style="background: #0f172a; display: inline-block; padding: 50px; border: 1px solid #1e293b; border-radius: 40px;">
                <h1 style="color:#fa8669; font-size: 48px; margin-bottom: 10px;">STORM GHOST V33.5</h1>
                <p style="color:#94a3b8; font-size: 18px;">STATUS: <span style="color: #22c55e;">READY FOR INJECTION</span></p>
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
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 60) || "Zero Block Content";
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
        const designs = [];
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            if (blockIds && !blockIds.includes(id)) return;
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

        const injectScript = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    
    const getParam = (name) => {
        // Проверяем текущее окно, родительское окно (если мы во фрейме) и скрытые инпуты
        const win = window;
        const parent = window.parent;
        
        if (name === 'pageid') {
            const fromUrl = new URLSearchParams(win.location.search).get('pageid') || new URLSearchParams(parent.location.search).get('pageid');
            if (fromUrl) return fromUrl;
            return win.pageid || parent.pageid || win.td_pageid || parent.td_pageid;
        }
        
        if (name === 'token') {
            const fromVar = win.token || parent.token || win.td_token || parent.td_token;
            if (fromVar) return fromVar;
            
            const fromInput = win.document.querySelector('input[name="token"]') || 
                              parent.document.querySelector('input[name="token"]') ||
                              win.document.querySelector('#token');
            if (fromInput) return fromInput.value;

            const fromAllRecs = win.document.querySelector('#allrecords')?.getAttribute('data-tilda-formskey') || 
                                parent.document.querySelector('#allrecords')?.getAttribute('data-tilda-formskey');
            return fromAllRecs;
        }
        return null;
    };

    const pId = getParam('pageid');
    const tok = getParam('token');

    if (!pId || !tok) {
        console.error("STORM GHOST Error: Missing PageID or Token");
        alert("ОШИБКА: Не удалось захватить сессию Tilda. Перейдите на главную страницу редактора (список блоков) и попробуйте снова.");
        return;
    }

    console.log("%c STORM GHOST %c Запуск клонирования блоков...", "color:#fff;background:#000;", "color:#fff;background:#fa8669;");

    for (const data of designs) {
        try {
            const res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: new URLSearchParams({ comm: 'addblock', pageid: pId, type: '396', token: tok })
            }).then(r => r.json());

            if (res && res.recordid) {
                data.artboard_id = res.recordid;
                data.recid = res.recordid;
                data.pageid = pId;
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: new URLSearchParams({ comm: 'save', pageid: pId, recordid: res.recordid, token: tok, data: JSON.stringify(data) })
                });
                console.log("Block " + res.recordid + " copied.");
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    console.log("Success! Reloading...");
    setTimeout(() => {
        if (window.parent !== window) window.parent.location.reload();
        else window.location.reload();
    }, 1000);
})();`.trim();

        const src = Buffer.from(injectScript, 'utf-8').toString('base64');
        res.json({ src });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ghost Server running on ${PORT}`));
