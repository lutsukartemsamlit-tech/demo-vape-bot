module.exports = async function handler(req, res) {
  const { fileId } = req.query;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' });
  }
  
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not configured');
    return res.status(500).json({ error: 'Bot token not configured' });
  }
  
  try {
    // Декодируем fileId
    const decodedFileId = decodeURIComponent(fileId);
    console.log('Fetching photo for fileId:', decodedFileId.substring(0, 20) + '...');
    
    // Получаем информацию о файле из Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(decodedFileId)}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    
    if (!fileInfoResponse.ok) {
      console.error(`Telegram API error: ${fileInfoResponse.status}`);
      return res.status(404).json({ error: 'File not found in Telegram' });
    }
    
    const fileInfo = await fileInfoResponse.json();
    console.log('File info result:', fileInfo.ok ? 'OK' : 'FAIL');
    
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      console.error('Invalid file info:', JSON.stringify(fileInfo));
      return res.status(404).json({ error: 'Invalid file info' });
    }
    
    // Загружаем файл из Telegram
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
    console.log('Downloading file from:', fileUrl.substring(0, 50) + '...');
    
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      console.error(`File download failed: ${fileResponse.status}`);
      return res.status(502).json({ error: 'Failed to download file' });
    }
    
    const buffer = await fileResponse.arrayBuffer();
    console.log('File downloaded, size:', buffer.byteLength, 'bytes');
    
    // Определяем content-type
    const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Кешируем на 24 часа
    
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Photo proxy error:', error.message, error.stack);
    res.status(502).json({ error: 'Failed to load photo', message: error.message });
  }
}
