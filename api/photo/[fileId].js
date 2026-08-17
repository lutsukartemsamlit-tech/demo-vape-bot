// Serverless функция для проксирования фото из Telegram
export default async function handler(req, res) {
  const { fileId } = req.query;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (!fileId || !BOT_TOKEN) {
    return res.status(400).send('Missing parameters');
  }
  
  try {
    // Получаем путь к файлу от Telegram
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`;
    const fileResponse = await fetch(apiUrl);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok) {
      return res.status(404).send('File not found');
    }
    
    // Получаем само изображение
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    const imageResponse = await fetch(fileUrl);
    
    if (!imageResponse.ok) {
      return res.status(404).send('Image not found');
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Photo proxy error:', error);
    res.status(502).send('Bad Gateway');
  }
}
