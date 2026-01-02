const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Функция нормализации координат и стилей (как у конкурента)
const normalizeElement = (el) => {
    // Принудительные шрифты и стили
    el['fontfamily'] = "'FuturaPT',Arial,sans-serif";
    el['fontweight'] = "400";
    el['bordercolor'] = "transparent";
    el['borderstyle'] = "solid";
    
    // Пересчет в Grid Calc
    if (el.left && !String(el.left).includes('calc')) {
        const posX = parseInt(el.left);
        if (!isNaN(posX)) {
            el.left = `calc(50% - 600px + ${posX}px)`;
        }
    }
    return el;
};

app.post('/tilda', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        // 1. Загружаем страницу донора
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);
        const designs = [];

        // 2. Ищем все Zero-блоки
        $('.r[data-record-type="396"]').each((i, rec) => {
            const artboard = $(rec).find('.t396__artboard');
            if (!artboard.length) return;

            const design = { elements: {} };
            
            // Собираем настройки артборда
            const attrs = artboard[0].attribs;
            Object.keys(attrs).forEach(attr => {
                if (attr.startsWith('data-artboard-')) {
                    design[attr.replace('data-artboard-', '')] = attrs[attr];
                }
            });

            // Собираем элементы
            $(rec).find('.tn-elem').each((j, el) => {
                const eid = $(el).attr('data-elem-id');
                const elementData = { id: eid, type: $(el).attr('data-elem-type') || 'text' };

                Object.keys(el.attribs).forEach(attr => {
                    if (attr.startsWith('data-field-')) {
                        const key = attr.replace('data-field-', '').replace('-value', '');
                        elementData[key] = el.attribs[attr];
                    }
                });

                // Текст или Картинка
                const atom = $(el).find('.tn-atom');
                if (elementData.type === 'text') {
                    elementData.text = atom.html();
                } else {
                    const img = $(el).find('img').attr('src') || atom.attr('data-original');
                    if (img) elementData.img = img;
                }

                design.elements[eid] = normalizeElement(elementData);
            });
            designs.push(design);
        });

        // 3. Генерируем финальный инъектор
        const injectionLogic = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    const pageId = window.pageid || window.tilda_page_id || document.querySelector('#allrecords')?.getAttribute('data-tilda-page-id');
    const token = window.token || document.querySelector('input[name="token"]')?.value;

    if (!pageId || !token) {
        alert("Ошибка: Откройте страницу со списком блоков в кабинете Tilda");
        return;
    }

    const req = async (p) => fetch('/page/submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: p
    }).then(r => r.json());

    console.log("%c STORM GHOST: Начинаю импорт " + designs.length + " блоков...", "color:#fff;background:#fa8669;padding:4px 10px;border-radius:4px;");

    for (let design of designs) {
        const res = await req(new URLSearchParams({ comm: 'addblock', pageid: pageId, type: '396', token: token }));
        if (res && res.recordid) {
            design.artboard_id = res.recordid;
            design.recid = res.recordid;
            design.pageid = pageid;
            await req(new URLSearchParams({
                comm: 'save', pageid: pageId, recordid: res.recordid, token: token, data: JSON.stringify(design)
            }));
        }
    }
    console.log("%c STORM GHOST: Успешно!", "color:#fff;background:#22c55e;padding:4px 10px;border-radius:4px;");
    setTimeout(() => window.location.reload(), 500);
})();`.trim();

        // Упаковка в Base64
        const encoded = Buffer.from(unescape(encodeURIComponent(injectionLogic))).toString('base64');
        res.json({ src: encoded });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
