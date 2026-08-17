export default async function handler(req, res) {
  const TUNNEL_URL = 'https://determining-knee-shipment-gospel.trycloudflare.com';
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  
  try {
    const { userId } = req.query;
    const response = await fetch(`${TUNNEL_URL}/api/chat/messages?userId=${userId}`);
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
