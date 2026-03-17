const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Garante que o arquivo data.json exista, servindo como banco de dados
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    // API GET - Retorna os dados do banco
    if (req.url === '/api/tasks' && req.method === 'GET') {
        fs.readFile(DATA_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Erro ao ler o banco de dados' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // API POST - Atualiza os dados do banco
    if (req.url === '/api/tasks' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Parse and stringify with formatting
                const jsonData = JSON.parse(body);
                const formattedBody = JSON.stringify(jsonData, null, 4);

                fs.writeFile(DATA_FILE, formattedBody, 'utf8', (err) => {
                    if (err) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON', details: e.message }));
            }
        });
        return;
    }

    // Servindo arquivos estáticos (index.html, style.css, script.js)
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    let extname = path.extname(filePath);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[extname] || 'text/plain' });
            res.end(content, 'utf-8');
        }
    });

});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`Servidor rodando em: http://localhost:${PORT}/`);
    console.log(`Os dados estão sendo salvos no arquivo: data.json`);
    console.log(`Pressione Ctrl+C para encerrar.`);
    console.log(`======================================================\n`);
});
