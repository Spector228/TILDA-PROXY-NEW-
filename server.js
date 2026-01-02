
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Лимиты увеличены для передачи тяжелых данных дизайна
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 1. Главная страница для проверки (GET /)
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align:center; padding: 100px 20px; background: #0f172a; min-height: 100vh; color: white;">
            <div style="background: #1e293b; display: inline-block; padding: 40px; rounded-radius: 20px; border: 1px solid #334155; border-radius: 30px; shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                <h1 style="color:#fa8669; font-size: 40px; margin-bottom: 10px; letter-spacing: -1px;">STORM GHOST PROXY</h1>
                <p style="color:#94a3b8; font-size: 16px;">Статус системы: <span style="color: #22c55e; font-weight: bold;">ONLINE</span></p>
                <div style="margin-top: 30px; font-size: 12px; color: #64748b; text-transform: uppercase; tracking: 2px;">Ready for POST requests at /tilda</div>
            </div>
        </div>
    `);
});

// Утилита для нормализации элементов (как у топовых конкурентов)
const normalizeElement = (el, baseUrl) => {
    // 1. Исправление путей к картинкам
    if (el.img && !el.img.startsWith('http')) {
        try {
            const absolute = new URL(el.img, baseUrl).href;
            el.img = absolute;
        } catch (e) {}
    }

    // 2. Центрирование по сетке (Grid Container Fix)
    // Если координата числовая, оборачиваем в calc для адаптивности
    if (el.left && !el.left.includes('calc') && !el.left.includes('%')) {
        const val = parseInt(el.left);
        if (!isNaN(val)) el.left = `calc(50% - 600px + ${val}px)`;
    }

    // 3. Дефолтные значения для стабильности импорта
    el['fontfamily'] = el['fontfamily'] || "Arial,sans-serif";
    el['bordercolor'] = el['bordercolor'] || "transparent";
    
    return el;
};

// 2. Эндпоинт обработки (POST /tilda)
app.post('/tilda', async (req, res) => {
    const { url, blockIds } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        console.log(`[REQ] Incoming request for: ${url}`);
        
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const designs = [];

        // Ищем только Zero Blocks (data-record-type="396")
        $('.r[data-record-type="396"]').each((i, rec) => {
            const currentId = $(rec).attr('id');
            
            // Если пришел список ID, фильтруем. Иначе берем все.
            if (blockIds && blockIds.length > 0 && !blockIds.includes(currentId)) return;

            const artboard = $(rec).find('.t396__artboard');
            if (!artboard.length) return;

            const design = { elements: {} };
            
            // Сбор данных артборда
            Object.keys(artboard[0].attribs).forEach(attr => {
                if (attr.startsWith('data-artboard-')) {
                    const key = attr.replace('data-artboard-', '');
                    design[key] = artboard[0].attribs[attr];
                }
            });

            // Сбор всех элементов (текст, шейпы, кнопки, картинки)
            $(rec).find('.tn-elem').each((j, el) => {
                const eid = $(el).attr('data-elem-id');
                const elementData = { id: eid, type: $(el).attr('data-elem-type') || 'text' };

                // Извлекаем все параметры Tilda
                Object.keys(el.attribs).forEach(attr => {
                    if (attr.startsWith('data-field-')) {
                        const key = attr.replace('data-field-', '').replace('-value', '');
                        elementData[key] = el.attribs[attr];
                    }
                    if (attr.startsWith('data-animate-')) {
                        const key = attr.replace('data-animate-', '');
                        elementData['anim-' + key] = el.attribs[attr];
                    }
                });

                // Контент
                const atom = $(el).find('.tn-atom');
                if (elementData.type === 'text') {
                    elementData.text = atom.html();
                } else {
                    const foundImg = $(el).find('img').attr('src') || atom.attr('data-original') || atom.css('background-image');
                    if (foundImg) {
                        elementData.img = foundImg.replace('url(', '').replace(')', '').replace(/["']/g, "");
                    }
                }

                design.elements[eid] = normalizeElement(elementData, url);
            });
            
            designs.push(design);
        });

        if (designs.length === 0) {
            return res.status(404).json({ error: 'No zero blocks found' });
        }

        // 3. Генерация финального скрипта инъекции
        // Этот код - сердце системы. Он выполняется в консоли Тильды.
        const injectionScript = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    const pId = window.pageid || document.querySelector('#allrecords')?.getAttribute('data-tilda-page-id');
    const tok = window.token || document.querySelector('input[name="token"]')?.value;

    if (!pId || !tok) {
        alert("ОШИБКА: Откройте страницу редактирования (список блоков) в Tilda!");
        return;
    }

    const api = async (p) => fetch('/page/submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams(p)
    }).then(r => r.json());

    console.log("%c STORM GHOST: Подготовка к импорту " + designs.length + " блоков...", "color:#fff;background:#fa8669;padding:8px 20px;border-radius:10px;font-weight:bold;");

    for (let i = 0; i < designs.length; i++) {
        const d = designs[i];
        console.log("%c -> Копирование блока " + (i+1) + "...", "color:#fa8669;");
        
        const add = await api({ comm: 'addblock', pageid: pId, type: '396', token: tok });
        if (add && add.recordid) {
            d.artboard_id = add.recordid;
            d.recid = add.recordid;
            d.pageid = pId;
            await api({ comm: 'save', pageid: pId, recordid: add.recordid, token: tok, data: JSON.stringify(d) });
        }
    }

    console.log("%c ГОТОВО! Сейчас страница обновится...", "color:#fff;background:#22c55e;padding:8px 20px;border-radius:10px;");
    setTimeout(() => window.location.reload(), 1500);
})();`.trim();

        // Кодируем в Base64 для передачи через "Short Loader"
        const finalBase64 = Buffer.from(unescape(encodeURIComponent(injectionScript))).toString('base64');
        
        res.json({ src: finalBase64 });

    } catch (err) {
        console.error(`[ERR] ${err.message}`);
        res.status(500).json({ error: 'Server error', msg: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
