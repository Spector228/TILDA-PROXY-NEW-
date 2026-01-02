const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Разрешаем CORS, чтобы ваш фронтенд и консоль Тильды могли делать запросы
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Проверка работоспособности (для GET запроса в браузере)
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family:sans-serif; text-align:center; padding-top:100px;">
            <h1 style="color:#fa8669;">STORM GHOST Proxy Online</h1>
            <p style="color:#666;">Сервер готов к работе. Используйте POST /tilda для захвата блоков.</p>
            <div style="display:inline-block; padding:10px 20px; background:#eee; border-radius:5px; font-weight:bold;">Статус: OK</div>
        </div>
    `);
});

// Функция нормализации (фишка конкурента для идеальной сетки)
const normalizeElement = (el) => {
    // Устанавливаем стандартные шрифты и стили
    el['fontfamily'] = el['fontfamily'] || "'FuturaPT',Arial,sans-serif";
    
    // Преобразование координат в Grid Container (calc)
    // Это позволяет блоку выглядеть одинаково на всех экранах
    if (el.left && !String(el.left).includes('calc')) {
        const posX = parseInt(el.left);
        if (!isNaN(posX)) {
            el.left = `calc(50% - 600px + ${posX}px)`;
        }
    }
    
    // Принудительные настройки для чистоты кода
    el['bordercolor'] = el['bordercolor'] || "transparent";
    el['borderstyle'] = el['borderstyle'] || "solid";
    
    return el;
};

// 2. Основной обработчик захвата блоков
app.post('/tilda', async (req, res) => {
    const { url, blockIds } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        console.log(`[LOG] Processing URL: ${url}`);
        
        // Загружаем HTML страницы-донора
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const designs = [];

        // Ищем Zero-блоки (тип 396)
        $('.r[data-record-type="396"]').each((i, rec) => {
            const currentId = $(rec).attr('id');
            
            // Если указаны конкретные ID, фильтруем. Если нет - берем все.
            if (blockIds && blockIds.length > 0 && !blockIds.includes(currentId)) {
                return;
            }

            const artboard = $(rec).find('.t396__artboard');
            if (!artboard.length) return;

            // Собираем данные артборда (высота, фон и т.д.)
            const design = { elements: {} };
            const attrs = artboard[0].attribs;
            Object.keys(attrs).forEach(attr => {
                if (attr.startsWith('data-artboard-')) {
                    const key = attr.replace('data-artboard-', '');
                    design[key] = attrs[attr];
                }
            });

            // Собираем элементы внутри блока
            $(rec).find('.tn-elem').each((j, el) => {
                const eid = $(el).attr('data-elem-id');
                const elementData = { 
                    id: eid, 
                    type: $(el).attr('data-elem-type') || 'text' 
                };

                // Вытаскиваем все data-field-* атрибуты
                Object.keys(el.attribs).forEach(attr => {
                    if (attr.startsWith('data-field-')) {
                        const key = attr.replace('data-field-', '').replace('-value', '');
                        elementData[key] = el.attribs[attr];
                    }
                });

                // Контент: Текст (HTML) или Картинка
                const atom = $(el).find('.tn-atom');
                if (elementData.type === 'text') {
                    elementData.text = atom.html();
                } else {
                    const img = $(el).find('img').attr('src') || atom.attr('data-original') || atom.css('background-image');
                    if (img) elementData.img = img.replace('url(', '').replace(')', '').replace(/["']/g, "");
                }

                design.elements[eid] = normalizeElement(elementData);
            });
            
            designs.push(design);
        });

        if (designs.length === 0) {
            return res.status(404).json({ error: 'Zero blocks not found on this page' });
        }

        // 3. Генерируем "Тяжелую логику" (Inject Logic)
        // Этот код выполнится в браузере пользователя
        const injectionLogic = `
(async function() {
    const designs = ${JSON.stringify(designs)};
    const pageId = window.pageid || window.tilda_page_id || document.querySelector('#allrecords')?.getAttribute('data-tilda-page-id');
    const token = window.token || document.querySelector('input[name="token"]')?.value;

    if (!pageId || !token) {
        alert("ОШИБКА: Запустите этот код на странице редактирования Tilda (там, где список всех блоков)");
        return;
    }

    const tildaApi = async (params) => fetch('/page/submit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams(params)
    }).then(r => r.json());

    console.log("%c STORM GHOST: Запуск импорта " + designs.length + " блоков...", "color:#fff;background:#fa8669;padding:5px 15px;border-radius:5px;font-weight:bold;");

    for (let i = 0; i < designs.length; i++) {
        const design = designs[i];
        console.log("%c Загрузка блока " + (i+1) + "/" + designs.length + "...", "color:#fa8669;");
        
        // 1. Создаем пустой Zero Block
        const addRes = await tildaApi({ 
            comm: 'addblock', 
            pageid: pageId, 
            type: '396', 
            token: token 
        });

        if (addRes && addRes.recordid) {
            const newRecId = addRes.recordid;
            
            // Подготавливаем данные дизайна для сохранения
            design.artboard_id = newRecId;
            design.recid = newRecId;
            design.pageid = pageId;

            // 2. Сохраняем данные в созданный блок
            await tildaApi({
                comm: 'save',
                pageid: pageId,
                recordid: newRecId,
                token: token,
                data: JSON.stringify(design)
            });
        }
    }

    console.log("%c STORM GHOST: Успешно завершено! Перезагрузка...", "color:#fff;background:#22c55e;padding:5px 15px;border-radius:5px;font-weight:bold;");
    setTimeout(() => window.location.reload(), 1000);
})();`.trim();

        // Упаковываем всю логику в Base64 (как у конкурента)
        const encodedSrc = Buffer.from(unescape(encodeURIComponent(injectionLogic))).toString('base64');
        
        console.log(`[SUCCESS] Generated payload for ${designs.length} blocks`);
        res.json({ src: encodedSrc });

    } catch (err) {
        console.error(`[ERROR] ${err.message}`);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`----------------------------------------`);
    console.log(`STORM GHOST Proxy is running on port ${PORT}`);
    console.log(`Endpoint: POST /tilda`);
    console.log(`----------------------------------------`);
});
