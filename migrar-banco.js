// =====================================================================
// 🚀 BYPASS DE REDE: Força o uso do DNS do Google (8.8.8.8)
// Isso resolve o bloqueio ECONNREFUSED de operadoras e roteadores!
// =====================================================================
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    console.log("🌐 Rota de DNS do Google ativada para contornar bloqueios...");
} catch (e) {
    console.log("⚠️ Não foi possível alterar o DNS local, tentando rota padrão...");
}

const fs = require('fs');
const { MongoClient } = require('mongodb');

// A sua chave de conexão exata
const uri = "mongodb+srv://leandrofrederico23_db_user:CantinhoAcai2026@cluster0.scwnoyn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function migrar() {
    try {
        console.log("⏳ Conectando ao Banco de Dados na Nuvem...");
        await client.connect();
        
        // Criando o banco de dados chamado "meu_cantinho_acai"
        const db = client.db('meu_cantinho_acai');
        console.log("✅ Conectado com sucesso ao MongoDB!");

        // 1. Migrando Produtos
        console.log("📦 Lendo products.json...");
        const products = JSON.parse(fs.readFileSync('products.json', 'utf-8'));
        if (products.length > 0) {
            await db.collection('products').deleteMany({}); // Limpa antes de inserir
            await db.collection('products').insertMany(products);
            console.log(`✔️  ${products.length} Produtos enviados para a nuvem!`);
        }

        // 2. Migrando Pedidos
        console.log("🛒 Lendo orders.json...");
        const orders = JSON.parse(fs.readFileSync('orders.json', 'utf-8'));
        if (orders.length > 0) {
            await db.collection('orders').deleteMany({});
            await db.collection('orders').insertMany(orders);
            console.log(`✔️  ${orders.length} Pedidos enviados para a nuvem!`);
        }

        // 3. Migrando Caixa
        console.log("💰 Lendo caixa.json...");
        const caixa = JSON.parse(fs.readFileSync('caixa.json', 'utf-8'));
        if (caixa.length > 0) {
            await db.collection('caixa').deleteMany({});
            await db.collection('caixa').insertMany(caixa);
            console.log(`✔️  ${caixa.length} Registros de caixa enviados!`);
        }

        // 4. Migrando Clientes (Adequando o formato)
        console.log("👥 Lendo clientes.json...");
        const clientesObj = JSON.parse(fs.readFileSync('clientes.json', 'utf-8'));
        const clientesArray = Object.keys(clientesObj).map(fone => ({ telefone: fone, ...clientesObj[fone] }));
        if (clientesArray.length > 0) {
            await db.collection('clientes').deleteMany({});
            await db.collection('clientes').insertMany(clientesArray);
            console.log(`✔️  ${clientesArray.length} Clientes enviados para a nuvem!`);
        }

        // 5. Migrando Configurações da Loja
        console.log("⚙️ Lendo config.json...");
        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        await db.collection('config').deleteMany({});
        await db.collection('config').insertOne(config);
        console.log("✔️  Configurações enviadas!");

        console.log("\n🎉 UAU! MIGRAÇÃO CONCLUÍDA COM SUCESSO! SEUS DADOS ESTÃO SALVOS NA NUVEM! ☁️🚀");

    } catch (error) {
        console.error("\n❌ Erro durante a migração:", error);
    } finally {
        await client.close();
    }
}

migrar();