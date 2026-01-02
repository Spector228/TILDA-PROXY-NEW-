
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

        // ЭТОТ КОД БУДЕТ ВЫПОЛНЕН В БРАУЗЕРЕ (Инъектор)
        const clientCode = `
(async function() {
    var designs = ${JSON.stringify(designs)};
    var w = window;
    if (typeof w.token === "undefined" && w.parent) w = w.parent;
    
    var pId = w.pageid || (new URLSearchParams(w.location.search)).get('pageid');
    var tok = w.token || w.td_token || document.querySelector('input[name="token"]')?.value;

    if (!pId || !tok) {
        alert("Ошибка: Сессия не найдена. Попробуйте нажать на любой другой блок в списке, затем снова откройте консоль.");
        return;
    }

    console.log("STORM GHOST: Запуск копирования...");

    for (var i = 0; i < designs.length; i++) {
        var d = designs[i];
        try {
            var bodyAdd = "comm=addblock&pageid=" + pId + "&type=396&token=" + tok;
            var res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: bodyAdd
            }).then(r => r.json());

            if (res && res.recordid) {
                d.artboard_id = res.recordid;
                d.recid = res.recordid;
                d.pageid = pId;
                
                var bodySave = "comm=save&pageid=" + pId + "&recordid=" + res.recordid + "&token=" + tok + "&data=" + encodeURIComponent(JSON.stringify(d));
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: bodySave
                });
                console.log("Блок " + (i+1) + " готов.");
            }
        } catch (err) { console.error("Ghost Error:", err); }
    }
    
    alert("Успешно! " + designs.length + " блоков добавлено.");
    w.location.reload();
})();`.trim();

        // Отправляем в том же формате, что и конкурент
        const b64 = Buffer.from(clientCode, 'utf-8').toString('base64');
        res.json({ src: b64 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running...'));
