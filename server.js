const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('✅ Tilda Ghost Proxy OK!'));

app.post('/tilda/', async (req, res) => {
  const { url, blockId = null, scriptId, userId = 1522574078, messageId = 327826, count = 32 } = req.body;
  
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(response.data);
    const designs = [];
    
    // Парсим все T396 Zero Blocks
    $('.r[data-record-type="396"]').slice(0, count).each((i, rec) => {
      const design = { elements: {} };
      
      // Артборд
      const artboard = $(rec).find('.t396__artboard');
      if (artboard.length) {
        const attrs = artboard[0].attribs;
        Object.keys(attrs).forEach(attr => {
          if (attr.startsWith('data-artboard-')) {
            design[attr.replace('data-artboard-', '')] = attrs[attr];
          }
        });
      }
      
      // Элементы
      $(rec).find('.tn-elem').each((j, el) => {
        const eid = $(el).attr('data-elem-id');
        if (!eid) return;
        
        const elementData = {
          id: eid,
          type: $(el).attr('data-elem-type') || 'text',
          top: $(el).attr('data-field-top-value') || '0',
          left: `calc(50%
