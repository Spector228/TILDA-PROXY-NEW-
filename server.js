
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

        // ФИНАЛЬНЫЙ ИНЪЕКТОР (БЕЗОШИБОЧНЫЙ ПОИСК)
        const clientCode = `
(async function() {
    var designs = ${JSON.stringify(designs)};
    
    function getSession() {
        var p = null, t = null;
        var wins = [window, window.parent, window.top];
        
        for (var w of wins) {
            try {
                p = p || w.pageid || (w.all_records_data ? w.all_records_data.pageid : null);
                t = t || w.token || w.formstoken || w.td_token || (w.all_records_data ? w.all_records_data.token : null);
            } catch(e) {}
        }
        
        if (!p) {
            var urlP = new URLSearchParams(window.location.search).get('pageid') || new URLSearchParams(window.top.location.search).get('pageid');
            p = urlP;
        }
        
        if (!t) {
            t = document.querySelector('input[name="token"]')?.value || document.querySelector('#allrecords')?.getAttribute('data-tilda-formskey');
        }
        
        return { pageid: p, token: t };
    }

    var sess = getSession();
    var log = (m) => console.log("%c" + m, "color:#fff;background:#fa8669;padding:3px 10px;border-radius:5px;font-family:sans-serif;font-weight:bold;");

    if (!sess.pageid || !sess.token) {
        log("КРИТИЧЕСКАЯ ОШИБКА: ДАННЫЕ TILDA НЕ НАЙДЕНЫ");
        alert("Ошибка: Сессия не найдена. Убедитесь, что вы находитесь на странице редактирования (список блоков) и попробуйте еще раз.");
        return;
    }

    log("STORM GHOST: Начинаю импорт " + designs.length + " блоков...");

    for (var i = 0; i < designs.length; i++) {
        var d = designs[i];
        try {
            var body = "comm=addblock&pageid=" + sess.pageid + "&type=396&token=" + sess.token;
            var res = await fetch('/page/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: body
            }).then(r => r.json());

            if (res && res.recordid) {
                d.artboard_id = res.recordid;
                d.recid = res.recordid;
                d.pageid = sess.pageid;
                
                var saveBody = "comm=save&pageid=" + sess.pageid + "&recordid=" + res.recordid + "&token=" + sess.token + "&data=" + encodeURIComponent(JSON.stringify(d));
                await fetch('/page/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: saveBody
                });
                console.log("Ghost: [" + (i+1) + "/" + designs.length + "] Блок " + res.recordid + " готов.");
            }
        } catch (e) { console.error("Ошибка Ghost:", e); }
    }
    
    log("ИМПОРТ ЗАВЕРШЕН!");
    setTimeout(() => { window.top.location.reload(); }, 500);
})();`.trim();

        const b64 = Buffer.from(clientCode, 'utf-8').toString('base64');
        res.json({ src: b64 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
