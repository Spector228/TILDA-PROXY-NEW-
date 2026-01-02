
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
            <div style="background: #0f172a; display: inline-block; padding: 50px; border: 1px solid #1e293b; border-radius: 40px; box-shadow: 0 25px 50px -12px rgba(249, 115, 22, 0.2);">
                <h1 style="color:#fa8669; font-size: 48px; margin-bottom: 10px; font-weight: 900;">STORM GHOST V40</h1>
                <p style="color:#22c55e; font-size: 18px; font-weight: bold; letter-spacing: 2px;">UTF-8 BYPASS ACTIVE</p>
                <div style="margin-top: 30px; color: #64748b; font-size: 12px; font-family: monospace;">STABLE ENCODING • FIXED GRID</div>
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
            const preview = $(rec).find('.tn-atom').first().text().trim().substring(0, 60) || "Zero Block Layer";
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
        
        const blocks = [];
        $('.r[data-record-type="396"]').each((i, block) => {
            const recId = $(block).attr('id');
            if (blockIds && !blockIds.includes(recId)) return;
            
            const artboard = $(block).find('.t396__artboard');
            if (!artboard.length) return;

            const blockData = {
                recordid: recId,
                html: artboard[0].outerHTML,
                elements: []
            };
            
            $(block).find('.tn-elem').each((j, elem) => {
                blockData.elements.push({
                    id: $(elem).attr('data-elem-id'),
                    top: $(elem).attr('data-field-top-value') || '0',
                    left: $(elem).attr('data-field-left-value') || '0'
                });
            });
            blocks.push(blockData);
        });

        const ghostCode = `
(()=>{
    console.clear();
    console.log('%c🚀 STORM GHOST: Копирование ${blocks.length} блоков...', 'color:#fff;background:#fa8669;font-size:large;padding:10px;font-weight:bold;');
    
    const container = document.querySelector('#allrecords') || document.body;
    const blocks = ${JSON.stringify(blocks)};
    
    blocks.forEach((block, i) => {
        const div = document.createElement('div');
        div.className = 'r t-rec';
        div.id = 'rec' + Math.floor(Math.random() * 1000000);
        div.dataset.recordType = '396';
        div.innerHTML = block.html;
        
        block.elements.forEach(elData => {
            const el = div.querySelector('[data-elem-id="' + elData.id + '"]');
            if (el) {
                el.style.top = elData.top + 'px';
                el.style.left = 'calc(50% - 600px + ' + elData.left + 'px)';
                el.style.position = 'absolute';
            }
        });
        
        container.appendChild(div);
        if (window.t396_init) {
            try { window.t396_init(div.id.replace('rec', '')); } catch(e) {}
        }
    });
    
    console.log('%c✅ ИМПОРТ ЗАВЕРШЕН! Блоки добавлены.', 'color:#fff;background:#22c55e;font-size:large;padding:10px;');
    alert("STORM GHOST: " + blocks.length + " блоков успешно внедрены!");
})();`.trim();

        // Важно: Просто Buffer.from(str) использует UTF-8 по умолчанию
        const src = Buffer.from(ghostCode).toString('base64');
        res.json({ src });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ghost Server running on ${PORT}`));
