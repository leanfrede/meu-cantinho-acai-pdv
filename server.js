const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const FILE_PRODUCTS = path.join(__dirname, 'products.json');
const FILE_ORDERS = path.join(__dirname, 'orders.json');
const FILE_CAIXA = path.join(__dirname, 'caixa.json');
const FILE_CLIENTES = path.join(__dirname, 'clientes.json');

function inicializarArquivos() {
    if (!fs.existsSync(FILE_PRODUCTS)) fs.writeFileSync(FILE_PRODUCTS, JSON.stringify([]));
    if (!fs.existsSync(FILE_ORDERS)) fs.writeFileSync(FILE_ORDERS, JSON.stringify([]));
    if (!fs.existsSync(FILE_CAIXA)) fs.writeFileSync(FILE_CAIXA, JSON.stringify([]));
    if (!fs.existsSync(FILE_CLIENTES)) fs.writeFileSync(FILE_CLIENTES, JSON.stringify({}));
}
inicializarArquivos();

/* --- ROTAS DE PRODUTOS --- */
app.get('/api/products', (req, res) => {
    const data = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    res.json(JSON.parse(data));
});

app.post('/api/products', (req, res) => {
    const { name, category, price, estoque } = req.body;
    const usuario = req.headers['x-usuario'] || 'Sistema';
    const data = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    const products = JSON.parse(data);
    
    const novoProduto = {
        id: products.length > 0 ? products[products.length - 1].id + 1 : 1,
        name, category, price: parseFloat(price), 
        estoque: parseInt(estoque) || 50, // Define o estoque inicial (padrão 50)
        available: true,
        usuarioAtividade: usuario, dataAtividade: new Date().toISOString()
    };
    products.push(novoProduto);
    fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));
    res.status(201).json(novoProduto);
});

app.put('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price, available, estoque, adicionarEstoque } = req.body;
    const usuario = req.headers['x-usuario'] || 'Sistema';
    const data = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    const products = JSON.parse(data);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: "Não encontrado" });
    
    products[index].name = name || products[index].name;
    products[index].price = price !== undefined ? parseFloat(price) : products[index].price;
    if (available !== undefined) products[index].available = available;
    
    // Atualização ou Reposição de Estoque
    if (estoque !== undefined) products[index].estoque = parseInt(estoque);
    if (adicionarEstoque) {
        products[index].estoque = (products[index].estoque || 0) + parseInt(adicionarEstoque);
        if (products[index].estoque > 0) products[index].available = true; // Reativa se estava esgotado
    }
    
    products[index].usuarioAtividade = usuario;
    products[index].dataAtividade = new Date().toISOString();
    
    fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));
    res.json(products[index]);
});

app.delete('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const data = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    let products = JSON.parse(data);
    products = products.filter(p => p.id !== id);
    fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));
    res.json({ success: true });
});

/* --- ROTAS DE CLIENTES (FIDELIDADE) --- */
app.get('/api/clientes/:telefone', (req, res) => {
    const tel = req.params.telefone;
    const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
    const clientes = JSON.parse(dataCli);
    res.json({ pedidos: clientes[tel] ? clientes[tel].pedidos : 0 });
});

/* --- ROTAS DE VENDAS --- */
app.get('/api/orders', (req, res) => {
    const data = fs.readFileSync(FILE_ORDERS, 'utf-8');
    res.json(JSON.parse(data));
});

app.post('/api/orders', (req, res) => {
    const { itens, total, formaPagamento, valorRecebido, troco, tipoPedido, taxaEntrega, clienteFidelidade, data } = req.body;
    const fileData = fs.readFileSync(FILE_ORDERS, 'utf-8');
    const orders = JSON.parse(fileData);
    
    // 1. BAIXA AUTOMÁTICA NO ESTOQUE
    const dataProd = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    let products = JSON.parse(dataProd);
    
    itens.forEach(item => {
        const indexProd = products.findIndex(p => p.id === item.id);
        if (indexProd !== -1) {
            let estoqueAtual = products[indexProd].estoque !== undefined ? products[indexProd].estoque : 50;
            estoqueAtual -= 1; // Subtrai 1 unidade
            if (estoqueAtual <= 0) {
                estoqueAtual = 0;
                products[indexProd].available = false; // Esgota automaticamente se zerar
            }
            products[indexProd].estoque = estoqueAtual;
        }
    });
    fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));
    // Fim da Baixa de Estoque

    const novaVenda = {
        id: orders.length > 0 ? orders[orders.length - 1].id + 1 : 1,
        itens, total: parseFloat(total), formaPagamento, valorRecebido, troco,
        tipoPedido: tipoPedido || 'Balcão', taxaEntrega: taxaEntrega ? parseFloat(taxaEntrega) : 0,
        clienteFidelidade: clienteFidelidade || null,
        status: 'Pendente', data: data || new Date().toISOString()
    };
    
    if (clienteFidelidade) {
        const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
        const clientes = JSON.parse(dataCli);
        if (!clientes[clienteFidelidade]) clientes[clienteFidelidade] = { pedidos: 0 };
        clientes[clienteFidelidade].pedidos += 1;
        if (clientes[clienteFidelidade].pedidos > 10) clientes[clienteFidelidade].pedidos = 1;
        fs.writeFileSync(FILE_CLIENTES, JSON.stringify(clientes, null, 2));
        novaVenda.pontosAtuais = clientes[clienteFidelidade].pedidos;
    }

    orders.push(novaVenda);
    fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
    res.status(201).json(novaVenda);
});

app.delete('/api/orders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const usuario = req.headers['x-usuario'] || 'Sistema';
    const motivo = req.headers['x-motivo'] || 'Não especificado'; 
    const data = fs.readFileSync(FILE_ORDERS, 'utf-8');
    let orders = JSON.parse(data);
    const index = orders.findIndex(o => o.id === id);
    
    if (index !== -1 && orders[index].status !== 'Cancelado') {
        orders[index].status = 'Cancelado';
        orders[index].canceladoPor = usuario;
        orders[index].canceladoEm = new Date().toISOString();
        orders[index].motivoCancelamento = motivo; 
        
        // 2. ESTORNO INTELIGENTE DE ESTOQUE (+1 de volta para cada item)
        const dataProd = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
        let products = JSON.parse(dataProd);
        orders[index].itens.forEach(item => {
            const indexProd = products.findIndex(p => p.id === item.id);
            if (indexProd !== -1) {
                products[indexProd].estoque = (products[indexProd].estoque || 0) + 1;
                products[indexProd].available = true; // Reativa o produto caso tivesse zerado
            }
        });
        fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));
        // Fim do estorno de estoque

        if (orders[index].clienteFidelidade) {
            const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
            const clientes = JSON.parse(dataCli);
            if (clientes[orders[index].clienteFidelidade] && clientes[orders[index].clienteFidelidade].pedidos > 0) {
                clientes[orders[index].clienteFidelidade].pedidos -= 1;
                fs.writeFileSync(FILE_CLIENTES, JSON.stringify(clientes, null, 2));
            }
        }
        fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
    }
    res.json({ success: true });
});

app.put('/api/orders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const data = fs.readFileSync(FILE_ORDERS, 'utf-8');
    const orders = JSON.parse(data);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return res.status(404).json({ error: "Não encontrado" });
    orders[index].status = status || orders[index].status;
    fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
    res.json(orders[index]);
});

/* --- ROTAS DE CAIXA --- */
app.get('/api/caixa', (req, res) => {
    const data = fs.readFileSync(FILE_CAIXA, 'utf-8');
    res.json(JSON.parse(data));
});

app.post('/api/caixa', (req, res) => {
    const { tipo, valor, motivo, data } = req.body;
    const usuario = req.headers['x-usuario'] || 'Sistema';
    const fileData = fs.readFileSync(FILE_CAIXA, 'utf-8');
    const movimentacoes = JSON.parse(fileData);
    
    const novaMovimentacao = {
        id: movimentacoes.length > 0 ? movimentacoes[movimentacoes.length - 1].id + 1 : 1,
        tipo, valor: parseFloat(valor), motivo, data: data || new Date().toISOString(),
        usuarioAtividade: usuario
    };
    movimentacoes.push(novaMovimentacao);
    fs.writeFileSync(FILE_CAIXA, JSON.stringify(movimentacoes, null, 2));
    res.status(201).json(novaMovimentacao);
});

app.listen(PORT, () => {
    console.log("🚀 Servidor auditado rodando em http://localhost:3000");
});