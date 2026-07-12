const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Configuração para o servidor entender os dados do carrinho
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// LIGAÇÃO À BASE DE DADOS (Cria um ficheiro novo automaticamente)
const db = new sqlite3.Database('./pdv.sqlite', (err) => {
    if (err) {
        console.error("❌ Erro ao ligar à base de dados:", err.message);
    } else {
        console.log("✅ Ligado à base de dados (pdv.sqlite).");
        
        // Cria a tabela de PRODUTOS
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            category TEXT
        )`);

        // Cria a tabela de VENDAS (agora com a coluna payment_method correta!)
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            items TEXT,
            total REAL,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Cria a tabela de FECHAMENTOS DE CAIXA
        db.run(`CREATE TABLE IF NOT EXISTS fechamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            valorInicial REAL,
            vendasDoDia REAL,
            totalEsperado REAL,
            totalGaveta REAL
        )`);
    }
});

// ==========================================
// ROTAS DO CARDÁPIO (PRODUTOS)
// ==========================================
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', (req, res) => {
    const { name, price, category } = req.body;
    db.run("INSERT INTO products (name, price, category) VALUES (?, ?, ?)", [name, price, category], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { name, price, category } = req.body;
    db.run("UPDATE products SET name = ?, price = ?, category = ? WHERE id = ?", [name, price, category, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Produto atualizado com sucesso!" });
    });
});

app.delete('/api/products/:id', (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Produto eliminado" });
    });
});

// ==========================================
// ROTAS DE VENDAS E CARRINHO
// ==========================================
app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/orders', (req, res) => {
    console.log("🛒 Recebendo nova venda..."); 
    
    const { items, total, payment_method } = req.body;
    
    db.run("INSERT INTO orders (items, total, payment_method) VALUES (?, ?, ?)", [items, total, payment_method], function(err) {
        if (err) {
            console.error("❌ Erro grave ao guardar a venda:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Venda guardada com sucesso! ID da venda: ${this.lastID} | Total: R$ ${total}`);
        res.json({ message: "Venda guardada", id: this.lastID });
    });
});

// ==========================================
// ROTAS DO FECHAMENTO DE CAIXA
// ==========================================
app.post('/abrir-caixa', (req, res) => {
    res.json({ message: "Caixa aberto com sucesso!" });
});

app.post('/api/fechamento', (req, res) => {
    const { data, valorInicial, vendasDoDia, totalEsperado, totalGaveta } = req.body;
    db.run("INSERT INTO fechamentos (data, valorInicial, vendasDoDia, totalEsperado, totalGaveta) VALUES (?, ?, ?, ?, ?)", 
    [data, valorInicial, vendasDoDia, totalEsperado, totalGaveta], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Fechamento registado" });
    });
});

app.get('/api/fechamentos', (req, res) => {
    db.all("SELECT * FROM fechamentos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// LIGA O SERVIDOR
app.listen(port, () => {
    console.log(`🚀 Sistema do Cantinho do Açaí a correr em http://localhost:${port}`);
});