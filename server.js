
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Разрешаем CORS для всех запросов
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Главная страница для проверки жизни сервера
app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(`
        <div style="font-family: sans-serif; text-align:center; padding: 100px 20px; background: #020617; min-height: 100vh; color: white;">
            <div style="background: #0f172a; display: inline-block; padding: 50px; border: 1px solid #1e293b; border-radius: 40px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <h1 style="color:#fa8669; font-size: 48px; margin-bottom: 10px; letter-spacing: -2px; font-style: italic; font-weight: 900;">STORM GHOST V33</h1>
                <p style="color:#94a3b8; font-size: 18px; font-weight: bold; letter-spacing: 2px;">STATUS: <span style="color: #22c55e;">ONLINE</span></p>
                <div style="margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 20px; text-align: left; font-family: monospace; font-size: 13px; color: #64748b;">
                   [OK] POST /scan is active<br>
                   [OK] POST /tilda is active<br>
                   [OK] CORS headers enabled
                </div>
            </div>
        </div>
    `);
});

// Эндпоинт для сканирования блоков
app.post('/scan', async (req, res) => {
    console.log('Incoming scan request for:', req.body.url);
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
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 60) || "Empty Zero Block";
            blocks.push({
                id: id,
                description: preview,
                type: '396'
            });
        });

        res.json({ success: true, blocks, total: blocks.length });
    } catch (err) {
        console.error('Scan error:', err.message);
        res.status(500).json({ error: 'Could not scan target site: ' + err.message });
    }
});

// Эндпоинт для получения данных блоков
app.post('/tilda', async (req, res) => {
    const { url, blockIds } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);
        const designs = [];

        $('.r[data-record-type="396"]').each((_, rec) => {
            const id = $(rec).attr('id');
            if (blockIds && blockIds.length > 0 && !blockIds.includes(id)) return;

            const ab = $(rec).find('.t396__artboard');
            if (!ab.length) return;

            const design = { elements: {} };
            // Копируем атрибуты артборда
            Object.keys(ab[0].attribs).forEach(a => {
                if (a.startsWith('data-artboard-')) {
                    design[a.replace('data-artboard-', '')] = ab[0].attribs[a];
                }
            });

            // Копируем элементы
            $(rec).find('.tn-elem').each((__, el) => {
                const eid = $(el).attr('data-elem-id');
                const element = { id: eid, type: $(el).attr('data-elem-type') || 'text' };

                Object.keys(el.attribs).forEach(a => {
                    if (a.startsWith('data-field-')) {
                        element[a.replace('data-field-', '').replace('-value', '')] = el.attribs[a];
                    }
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

        // Формируем финальный скрипт инъекции
        const injectScript = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    const pId = window.pageid || document.querySelector('#allrecords')?.getAttribute('data-tilda-page-id');
    const tok = window.token || document.querySelector('input[name="token"]')?.value;

    if (!pId || !tok) {
        alert("Запустите этот код в редакторе страницы Tilda!");
        return;
    }

    console.log("%c STORM GHOST %c Начинаю импорт " + designs.length + " блоков...", "color:#fff;background:#000;padding:5px;", "color:#fff;background:#fa8669;padding:5px;");

    for (const data of designs) {
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
        }
    }
    window.location.reload();
})();`.trim();

        const src = Buffer.from(unescape(encodeURIComponent(injectScript))).toString('base64');
        res.json({ src });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Ghost is running on port ${PORT}`));
