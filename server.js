
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.send('STORM GHOST SERVER ACTIVE');
});

app.post('/scan', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const blocks = [];
        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 50) || "Zero Block";
            blocks.push({ id, description: preview, type: '396' });
        });
        res.json({ success: true, blocks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tilda', async (req, res) => {
    const { url, blockIds } = req.body;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
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

        // ПРЯМАЯ ЛОГИКА КОНКУРЕНТА (без лишних проверок)
        const injectScript = `
(async function() {
    var ds = ${JSON.stringify(designs)};
    var win = window.parent !== window ? window.parent : window;
    
    // Получаем токены и ID как это делает конкурент
    var pId = win.pageid || win.td_pageid || (new URLSearchParams(win.location.search)).get('pageid');
    var tok = win.token || win.td_token || win.document.querySelector('input[name="token"]')?.value;

    if (!pId || !tok) {
        alert("Ошибка: Не найден token или pageid. Откройте консоль в общем списке блоков страницы.");
        return;
    }

    console.log("%cSTORM GHOST%c Начинаю копирование " + ds.length + " блоков...", "background:#fa8669;color:#fff;padding:5px;", "");

    for (var i = 0; i < ds.length; i++) {
        var data = ds[i];
        try {
            var res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: "comm=addblock&pageid=" + pId + "&type=396&token=" + tok
            }).then(r => r.json());

            if (res && res.recordid) {
                data.artboard_id = res.recordid;
                data.recid = res.recordid;
                data.pageid = pId;
                
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: "comm=save&pageid=" + pId + "&recordid=" + res.recordid + "&token=" + tok + "&data=" + encodeURIComponent(JSON.stringify(data))
                });
                console.log("Блок " + (i+1) + " из " + ds.length + " готов.");
            }
        } catch (e) { console.error(e); }
    }
    
    alert("Готово! Страница будет перезагружена.");
    win.location.reload();
})();`.trim();

        const src = Buffer.from(injectScript, 'utf-8').toString('base64');
        res.json({ src });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ghost Node on ${PORT}`));
