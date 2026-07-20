const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// MAGIA ANTIBLOQUEIO DO NGROK
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const FILE_PRODUCTS = path.join(__dirname, 'products.json');
const FILE_ORDERS = path.join(__dirname, 'orders.json');
const FILE_CAIXA = path.join(__dirname, 'caixa.json');
const FILE_CLIENTES = path.join(__dirname, 'clientes.json');
const FILE_CONFIG = path.join(__dirname, 'config.json');

function inicializarArquivos() {
    if (!fs.existsSync(FILE_PRODUCTS)) fs.writeFileSync(FILE_PRODUCTS, JSON.stringify([]));
    if (!fs.existsSync(FILE_ORDERS)) fs.writeFileSync(FILE_ORDERS, JSON.stringify([]));
    if (!fs.existsSync(FILE_CAIXA)) fs.writeFileSync(FILE_CAIXA, JSON.stringify([]));
    if (!fs.existsSync(FILE_CLIENTES)) fs.writeFileSync(FILE_CLIENTES, JSON.stringify({}));
    if (!fs.existsSync(FILE_CONFIG)) fs.writeFileSync(FILE_CONFIG, JSON.stringify({ taxaEntregaPadrao: 3.00 }));
}
inicializarArquivos();

/* --- ROTAS DE CONFIGURAÇÃO DA LOJA --- */
app.get('/api/config', (req, res) => {
    const data = fs.readFileSync(FILE_CONFIG, 'utf-8');
    res.json(JSON.parse(data));
});

app.put('/api/config', (req, res) => {
    const { taxaEntregaPadrao } = req.body;
    const config = { taxaEntregaPadrao: parseFloat(taxaEntregaPadrao) || 0 };
    fs.writeFileSync(FILE_CONFIG, JSON.stringify(config, null, 2));
    res.json(config);
});

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
        estoque: parseInt(estoque) || 50,
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
    
    if (estoque !== undefined) products[index].estoque = parseInt(estoque);
    if (adicionarEstoque) {
        products[index].estoque = (products[index].estoque || 0) + parseInt(adicionarEstoque);
        if (products[index].estoque > 0) products[index].available = true;
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

/* --- ROTAS DE CLIENTES & CRM INTELIGENTE --- */
app.get('/api/clientes', (req, res) => {
    const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
    const clientes = JSON.parse(dataCli);
    const listaClientes = [];
    const hoje = new Date().getTime();

    for (let fone in clientes) {
        const c = clientes[fone];
        let diasSumido = 0;
        if (c.ultimaCompra) {
            const diffTempo = hoje - new Date(c.ultimaCompra).getTime();
            diasSumido = Math.floor(diffTempo / (1000 * 3600 * 24));
        }
        listaClientes.push({
            telefone: fone,
            nome: c.nome || "Cliente (Sem Nome)",
            endereco: c.endereco || "Não cadastrado",
            pedidos: c.pedidos || 0,
            totalGasto: c.totalGasto || 0,
            primeiraCompra: c.primeiraCompra || null,
            ultimaCompra: c.ultimaCompra || null,
            diasSumido: diasSumido
        });
    }
    res.json(listaClientes);
});

app.get('/api/clientes/:telefone', (req, res) => {
    const tel = req.params.telefone;
    const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
    const clientes = JSON.parse(dataCli);
    res.json({ pedidos: clientes[tel] ? clientes[tel].pedidos : 0, dados: clientes[tel] || null });
});

/* --- ROTAS DE VENDAS --- */
app.get('/api/orders', (req, res) => {
    const data = fs.readFileSync(FILE_ORDERS, 'utf-8');
    res.json(JSON.parse(data));
});

app.post('/api/orders', (req, res) => {
    // 1. Recebemos o status enviado pelo Cardápio
    const { itens, total, formaPagamento, valorRecebido, troco, tipoPedido, taxaEntrega, clienteFidelidade, data, nomeClienteOnline, origem, detalheTroco, status } = req.body;
    const fileData = fs.readFileSync(FILE_ORDERS, 'utf-8');
    const orders = JSON.parse(fileData);
    
    const dataProd = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
    let products = JSON.parse(dataProd);
    
    itens.forEach(item => {
        const indexProd = products.findIndex(p => p.id === item.id);
        if (indexProd !== -1) {
            let estoqueAtual = products[indexProd].estoque !== undefined ? products[indexProd].estoque : 50;
            estoqueAtual -= 1;
            if (estoqueAtual <= 0) {
                estoqueAtual = 0;
                products[indexProd].available = false;
            }
            products[indexProd].estoque = estoqueAtual;
        }
    });
    fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));

    const novaVenda = {
        id: orders.length > 0 ? orders[orders.length - 1].id + 1 : 1,
        itens, total: parseFloat(total), formaPagamento, valorRecebido, troco,
        tipoPedido: tipoPedido || 'Balcão', taxaEntrega: taxaEntrega ? parseFloat(taxaEntrega) : 0,
        clienteFidelidade: clienteFidelidade || null,
        status: status || 'Pendente', // <--- A MÁGICA ACONTECE AQUI!
        origem: origem || 'Balcão',
        nomeClienteOnline: nomeClienteOnline || null,
        detalheTroco: detalheTroco || null,
        data: data || new Date().toISOString()
    };
    
    // ATUALIZAÇÃO DO BANCO DE DADOS DE CLIENTES E FIDELIDADE
    if (clienteFidelidade) {
        const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
        const clientes = JSON.parse(dataCli);
        
        if (!clientes[clienteFidelidade]) {
            clientes[clienteFidelidade] = {
                nome: nomeClienteOnline || "Cliente Balcão",
                endereco: tipoPedido.includes('Endereço:') ? tipoPedido.split('Endereço: ')[1].replace(')', '') : "Não cadastrado",
                pedidos: 0,
                totalGasto: 0,
                primeiraCompra: new Date().toISOString(),
                ultimaCompra: new Date().toISOString()
            };
        }

        if (nomeClienteOnline && clientes[clienteFidelidade].nome === "Cliente Balcão") {
            clientes[clienteFidelidade].nome = nomeClienteOnline;
        }
        if (tipoPedido.includes('Endereço:')) {
            clientes[clienteFidelidade].endereco = tipoPedido.split('Endereço: ')[1].replace(')', '');
        }

        clientes[clienteFidelidade].pedidos += 1;
        clientes[clienteFidelidade].totalGasto = (clientes[clienteFidelidade].totalGasto || 0) + parseFloat(total);
        clientes[clienteFidelidade].ultimaCompra = new Date().toISOString();

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
        
        const dataProd = fs.readFileSync(FILE_PRODUCTS, 'utf-8');
        let products = JSON.parse(dataProd);
        orders[index].itens.forEach(item => {
            const indexProd = products.findIndex(p => p.id === item.id);
            if (indexProd !== -1) {
                products[indexProd].estoque = (products[indexProd].estoque || 0) + 1;
                products[indexProd].available = true;
            }
        });
        fs.writeFileSync(FILE_PRODUCTS, JSON.stringify(products, null, 2));

        if (orders[index].clienteFidelidade) {
            const dataCli = fs.readFileSync(FILE_CLIENTES, 'utf-8');
            const clientes = JSON.parse(dataCli);
            if (clientes[orders[index].clienteFidelidade] && clientes[orders[index].clienteFidelidade].pedidos > 0) {
                clientes[orders[index].clienteFidelidade].pedidos -= 1;
                clientes[orders[index].clienteFidelidade].totalGasto -= orders[index].total;
                if(clientes[orders[index].clienteFidelidade].totalGasto < 0) clientes[orders[index].clienteFidelidade].totalGasto = 0;
                fs.writeFileSync(FILE_CLIENTES, JSON.stringify(clientes, null, 2));
            }
        }
        fs.writeFileSync(FILE_ORDERS, JSON.stringify(orders, null, 2));
    }
    res.json({ success: true });
});

app.put('/api/orders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { status, formaPagamento } = req.body;
    const data = fs.readFileSync(FILE_ORDERS, 'utf-8');
    const orders = JSON.parse(data);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return res.status(404).json({ error: "Não encontrado" });
    
    if (status) orders[index].status = status;
    if (formaPagamento) orders[index].formaPagamento = formaPagamento;
    
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