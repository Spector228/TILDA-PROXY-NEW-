
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.send('STORM GHOST ACTIVE');
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

app.post('/tilda', async (req, res) => {
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

        // ИНЪЕКТОР (То, что выполняется в консоли)
        // Мы ищем токен везде: и в текущем окне, и в родителе
        const clientCode = `
(async function() {
    var designs = ${JSON.stringify(designs)};
    
    function getVal(name) {
        if (window[name]) return window[name];
        if (window.parent && window.parent[name]) return window.parent[name];
        if (window.td_token) return window.td_token;
        if (window.parent && window.parent.td_token) return window.parent.td_token;
        return null;
    }

    var pId = getVal('pageid') || (new URLSearchParams(window.location.search)).get('pageid') || (window.parent ? (new URLSearchParams(window.parent.location.search)).get('pageid') : null);
    var tok = getVal('formstoken') || getVal('token') || document.querySelector('input[name="token"]')?.value;

    if (!pId || !tok) {
        alert("Ошибка: Сессия не найдена. Пожалуйста, закройте Zero Block и запустите код на странице со списком всех блоков.");
        return;
    }

    console.log("%cSTORM GHOST%c Начинаю копирование " + designs.length + " блоков...", "color:#fff;background:#fa8669;padding:3px 10px;border-radius:5px", "");

    for (var i = 0; i < designs.length; i++) {
        var d = designs[i];
        try {
            var res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: "comm=addblock&pageid=" + pId + "&type=396&token=" + tok
            }).then(r => r.json());

            if (res && res.recordid) {
                d.artboard_id = res.recordid;
                d.recid = res.recordid;
                d.pageid = pId;
                
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: "comm=save&pageid=" + pId + "&recordid=" + res.recordid + "&token=" + tok + "&data=" + encodeURIComponent(JSON.stringify(d))
                });
                console.log("Блок " + (i+1) + " из " + designs.length + " добавлен успешно.");
            }
        } catch (e) { console.error("Ошибка при копировании блока:", e); }
    }
    
    alert("Готово! Все блоки скопированы. Страница будет обновлена.");
    if (window.parent && window.parent.location) window.parent.location.reload();
    else window.location.reload();
})();`.trim();

        const b64 = Buffer.from(clientCode, 'utf-8').toString('base64');
        res.json({ src: b64 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running...'));
