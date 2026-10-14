const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  const filePath = 'C:/Users/Hp/Desktop/GUNNERIUS Kurulum.exe';
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="GUNNERIUS_Kurulum.exe"',
      'Content-Length': stat.size
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404);
    res.end('Dosya bulunamadi');
  }
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Sunucu calisiyor: port 8080');
});
