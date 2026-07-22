// =====================================================================
// 🚀 BYPASS DE REDE: Força DNS do Google para evitar bloqueio de ISP
// =====================================================================
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

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

// ==========================================================================
// 🛡️ CAMADA DE SEGURANÇA 1: O "CADEADO DO BACKEND"
// ==========================================================================
const SECRET_ADMIN_TOKEN = "AcaiCantinho_2026_SecureKey!"; 

function blindagemAdmin(req, res, next) {
    const tokenFornecido = req.headers['x-admin-token'];
    if (tokenFornecido === SECRET_ADMIN_TOKEN) {
        next(); 
    } else {
        console.warn(`🚨 TENTATIVA DE INVASÃO BLOQUEADA: ${req.method} ${req.url}`);
        res.status(403).json({ error: "🔒 Acesso Negado: Você não possui a Chave de Segurança Mestra." });
    }
}

// ==========================================================================
// ☁️ CONEXÃO COM A NUVEM (MONGODB ATLAS - AWS SÃO PAULO)
// ==========================================================================
const uri = "mongodb+srv://leandrofrederico23_db_user:CantinhoAcai2026@cluster0.scwnoyn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
let db;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db('meu_cantinho_acai');
        console.log("☁️  Conectado à Nuvem MongoDB Atlas com sucesso!");
    } catch (erro) {
        console.error("❌ Erro ao conectar no banco de dados:", erro);
    }
}
conectarBanco();

/* --- ROTAS DE CONFIGURAÇÃO DA LOJA --- */
app.get('/api/config', async (req, res) => {
    try {
        let config = await db.collection('config').findOne({});
        if (!config) config = { taxaEntregaPadrao: 3.00 };
        res.json(config);
    } catch (e) { res.status(500).json({ error: "Erro na nuvem" }); }
});

app.put('/api/config', blindagemAdmin, async (req, res) => {
    try {
        const { taxaEntregaPadrao } = req.body;
        const config = { taxaEntregaPadrao: parseFloat(taxaEntregaPadrao) || 0 };
        await db.collection('config').updateOne({}, { $set: config }, { upsert: true });
        res.json(config);
    } catch (e) { res.status(500).json({ error: "Erro ao salvar config" }); }
});

/* --- ROTAS DE PRODUTOS --- */
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.collection('products').find().toArray();
        res.json(products);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar produtos" }); }
});

app.post('/api/products', blindagemAdmin, async (req, res) => {
    try {
        const { name, category, price, estoque } = req.body;
        const usuario = req.headers['x-usuario'] || 'Sistema';
        
        // Gera um ID numérico sequencial simples
        const ultimoProd = await db.collection('products').find().sort({ id: -1 }).limit(1).toArray();
        const novoId = ultimoProd.length > 0 ? ultimoProd[0].id + 1 : 1;

        const novoProduto = {
            id: novoId,
            name, category, price: parseFloat(price), 
            estoque: parseInt(estoque) || 50,
            available: true,
            usuarioAtividade: usuario, dataAtividade: new Date().toISOString()
        };
        
        await db.collection('products').insertOne(novoProduto);
        res.status(201).json(novoProduto);
    } catch (e) { res.status(500).json({ error: "Erro ao criar produto" }); }
});

app.put('/api/products/:id', blindagemAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, price, available, estoque, adicionarEstoque } = req.body;
        const usuario = req.headers['x-usuario'] || 'Sistema';
        
        const produto = await db.collection('products').findOne({ id });
        if (!produto) return res.status(404).json({ error: "Não encontrado" });
        
        const atualizações = {
            usuarioAtividade: usuario,
            dataAtividade: new Date().toISOString()
        };

        if (name) atualizações.name = name;
        if (price !== undefined) atualizações.price = parseFloat(price);
        if (available !== undefined) atualizações.available = available;
        if (estoque !== undefined) atualizações.estoque = parseInt(estoque);
        
        if (adicionarEstoque) {
            const novoEstoque = (produto.estoque || 0) + parseInt(adicionarEstoque);
            atualizações.estoque = novoEstoque;
            if (novoEstoque > 0) atualizações.available = true;
        }
        
        await db.collection('products').updateOne({ id }, { $set: atualizações });
        const produtoAtualizado = await db.collection('products').findOne({ id });
        res.json(produtoAtualizado);
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar produto" }); }
});

app.delete('/api/products/:id', blindagemAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await db.collection('products').deleteOne({ id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro ao deletar produto" }); }
});

/* --- ROTAS DE CLIENTES & CRM (LGPD) --- */
app.get('/api/clientes', blindagemAdmin, async (req, res) => {
    try {
        const clientes = await db.collection('clientes').find().toArray();
        const hoje = new Date().getTime();

        const listaClientes = clientes.map(c => {
            let diasSumido = 0;
            if (c.ultimaCompra) {
                const diffTempo = hoje - new Date(c.ultimaCompra).getTime();
                diasSumido = Math.floor(diffTempo / (1000 * 3600 * 24));
            }
            return {
                telefone: c.telefone,
                nome: c.nome || "Cliente (Sem Nome)",
                endereco: c.endereco || "Não cadastrado",
                pedidos: c.pedidos || 0,
                totalGasto: c.totalGasto || 0,
                primeiraCompra: c.primeiraCompra || null,
                ultimaCompra: c.ultimaCompra || null,
                diasSumido: diasSumido
            };
        });
        res.json(listaClientes);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar clientes" }); }
});

app.get('/api/clientes/:telefone', async (req, res) => {
    try {
        const tel = req.params.telefone;
        const cliente = await db.collection('clientes').findOne({ telefone: tel });
        res.json({ pedidos: cliente ? cliente.pedidos : 0, dados: cliente || null });
    } catch (e) { res.status(500).json({ error: "Erro ao buscar cliente" }); }
});

/* --- ROTAS DE VENDAS --- */
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.collection('orders').find().toArray();
        res.json(orders);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar pedidos" }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { itens, total, formaPagamento, valorRecebido, troco, tipoPedido, taxaEntrega, clienteFidelidade, data, nomeClienteOnline, origem, detalheTroco, status } = req.body;
        
        // 1. Baixa no estoque dos produtos na nuvem
        for (let item of itens) {
            const prod = await db.collection('products').findOne({ id: item.id });
            if (prod) {
                let estoqueAtual = (prod.estoque !== undefined ? prod.estoque : 50) - 1;
                if (estoqueAtual <= 0) estoqueAtual = 0;
                await db.collection('products').updateOne(
                    { id: item.id }, 
                    { $set: { estoque: estoqueAtual, available: estoqueAtual > 0 } }
                );
            }
        }

        // 2. Gera ID sequencial da venda
        const ultimaVenda = await db.collection('orders').find().sort({ id: -1 }).limit(1).toArray();
        const novoId = ultimaVenda.length > 0 ? ultimaVenda[0].id + 1 : 1;

        const novaVenda = {
            id: novoId,
            itens, total: parseFloat(total), formaPagamento, valorRecebido, troco,
            tipoPedido: tipoPedido || 'Balcão', taxaEntrega: taxaEntrega ? parseFloat(taxaEntrega) : 0,
            clienteFidelidade: clienteFidelidade || null, status: status || 'Pendente',
            origem: origem || 'Balcão', nomeClienteOnline: nomeClienteOnline || null,
            detalheTroco: detalheTroco || null, data: data || new Date().toISOString()
        };
        
        // 3. Atualização do CRM de Clientes e Pontos de Fidelidade
        if (clienteFidelidade) {
            let cliente = await db.collection('clientes').findOne({ telefone: clienteFidelidade });
            if (!cliente) {
                cliente = {
                    telefone: clienteFidelidade,
                    nome: nomeClienteOnline || "Cliente Balcão",
                    endereco: tipoPedido.includes('Endereço:') ? tipoPedido.split('Endereço: ')[1].replace(')', '') : "Não cadastrado",
                    pedidos: 0, totalGasto: 0, primeiraCompra: new Date().toISOString(), ultimaCompra: new Date().toISOString()
                };
            }

            if (nomeClienteOnline && cliente.nome === "Cliente Balcão") cliente.nome = nomeClienteOnline;
            if (tipoPedido.includes('Endereço:')) cliente.endereco = tipoPedido.split('Endereço: ')[1].replace(')', '');

            cliente.pedidos = (cliente.pedidos || 0) + 1;
            cliente.totalGasto = (cliente.totalGasto || 0) + parseFloat(total);
            cliente.ultimaCompra = new Date().toISOString();

            if (cliente.pedidos > 10) cliente.pedidos = 1;
            
            await db.collection('clientes').updateOne(
                { telefone: clienteFidelidade }, 
                { $set: cliente }, 
                { upsert: true }
            );
            novaVenda.pontosAtuais = cliente.pedidos;
        }

        await db.collection('orders').insertOne(novaVenda);
        res.status(201).json(novaVenda);
    } catch (e) { 
        console.error("Erro ao criar pedido:", e);
        res.status(500).json({ error: "Erro ao criar pedido na nuvem" }); 
    }
});

app.delete('/api/orders/:id', blindagemAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const usuario = req.headers['x-usuario'] || 'Sistema';
        const motivo = req.headers['x-motivo'] || 'Não especificado'; 
        
        const order = await db.collection('orders').findOne({ id });
        if (order && order.status !== 'Cancelado') {
            
            // Devolve itens para o estoque
            for (let item of order.itens) {
                const prod = await db.collection('products').findOne({ id: item.id });
                if (prod) {
                    await db.collection('products').updateOne(
                        { id: item.id },
                        { $set: { estoque: (prod.estoque || 0) + 1, available: true } }
                    );
                }
            }

            // Estorna pontos e valor gasto do cliente
            if (order.clienteFidelidade) {
                const cliente = await db.collection('clientes').findOne({ telefone: order.clienteFidelidade });
                if (cliente && cliente.pedidos > 0) {
                    let novoTotal = cliente.totalGasto - order.total;
                    if (novoTotal < 0) novoTotal = 0;
                    await db.collection('clientes').updateOne(
                        { telefone: order.clienteFidelidade },
                        { $set: { pedidos: cliente.pedidos - 1, totalGasto: novoTotal } }
                    );
                }
            }

            // Marca o pedido como cancelado
            await db.collection('orders').updateOne(
                { id },
                { $set: { 
                    status: 'Cancelado', 
                    canceladoPor: usuario, 
                    canceladoEm: new Date().toISOString(), 
                    motivoCancelamento: motivo 
                }}
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro ao cancelar pedido" }); }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status, formaPagamento } = req.body;
        
        const atualizações = {};
        if (status) atualizações.status = status;
        if (formaPagamento) atualizações.formaPagamento = formaPagamento;
        
        await db.collection('orders').updateOne({ id }, { $set: atualizações });
        const orderAtualizado = await db.collection('orders').findOne({ id });
        res.json(orderAtualizado || {});
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar pedido" }); }
});

/* --- ROTAS DE CAIXA --- */
app.get('/api/caixa', async (req, res) => {
    try {
        const movimentacoes = await db.collection('caixa').find().toArray();
        res.json(movimentacoes);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar caixa" }); }
});

app.post('/api/caixa', async (req, res) => {
    try {
        const { tipo, valor, motivo, data } = req.body;
        const usuario = req.headers['x-usuario'] || 'Sistema';
        
        const ultimoCaixa = await db.collection('caixa').find().sort({ id: -1 }).limit(1).toArray();
        const novoId = ultimoCaixa.length > 0 ? ultimoCaixa[0].id + 1 : 1;

        const novaMovimentacao = {
            id: novoId,
            tipo, valor: parseFloat(valor), motivo, data: data || new Date().toISOString(),
            usuarioAtividade: usuario
        };
        await db.collection('caixa').insertOne(novaMovimentacao);
        res.status(201).json(novaMovimentacao);
    } catch (e) { res.status(500).json({ error: "Erro ao lançar no caixa" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});