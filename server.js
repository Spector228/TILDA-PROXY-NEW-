
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.send('STORM GHOST V33 ACTIVE');
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

        // ФИНАЛЬНЫЙ ИНЪЕКТОР (АНАЛОГ КОНКУРЕНТА)
        const clientCode = `
(async function() {
    var log = (m) => console.log("%c" + m, "color:#fff;background:#fa8669;padding:3px 10px;border-radius:5px;font-weight:bold;");
    
    function findVal(name) {
        var targets = [window, window.parent, window.top];
        for (var t of targets) {
            try {
                if (t[name]) return t[name];
                if (t.all_records_data && t.all_records_data[name]) return t.all_records_data[name];
            } catch(e) {}
        }
        return null;
    }

    var pId = findVal('pageid') || (new URLSearchParams(window.location.search)).get('pageid') || document.querySelector('#allrecords')?.getAttribute('data-tilda-page-id');
    var tok = findVal('token') || findVal('formstoken') || findVal('td_token') || document.querySelector('input[name="token"]')?.value || document.querySelector('#allrecords')?.getAttribute('data-tilda-formskey');

    if (!pId || !tok) {
        log("ОШИБКА: СЕССИЯ НЕ НАЙДЕНА");
        alert("Ошибка: Сессия не найдена. Убедитесь, что вы на странице списка блоков вашей Тильды (не внутри Zero Block).");
        return;
    }

    log("STORM GHOST: Копирование " + designs.length + " блоков...");

    for (var i = 0; i < designs.length; i++) {
        try {
            var addRes = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: "comm=addblock&pageid=" + pId + "&type=396&token=" + tok
            }).then(r => r.json());

            if (addRes && addRes.recordid) {
                var d = designs[i];
                d.artboard_id = addRes.recordid;
                d.recid = addRes.recordid;
                d.pageid = pId;
                
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: "comm=save&pageid=" + pId + "&recordid=" + addRes.recordid + "&token=" + tok + "&data=" + encodeURIComponent(JSON.stringify(d))
                });
                console.log("Ghost: Блок " + (i+1) + " [" + addRes.recordid + "] успешно скопирован.");
            }
        } catch (e) { console.error("Ghost Error:", e); }
    }
    
    log("ГОТОВО! ПЕРЕЗАГРУЗКА...");
    setTimeout(() => { window.top.location.reload(); }, 800);
})();`.trim();

        const b64 = Buffer.from(clientCode, 'utf-8').toString('base64');
        res.json({ src: b64 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server Ghost V33 running...'));
