const ORDERS_URL = 'http://localhost:3000/api/orders';
const PRODUCTS_URL = 'http://localhost:3000/api/products';

// =====================================================================
// 🗝️ CHAVE MESTRA DO SÓCIO-DONO (Liberar permissão total na Nuvem)
// =====================================================================
const SECRET_TOKEN = "AcaiCantinho_2026_SecureKey!";

let produtosCadastrados = []; // Guarda os produtos para facilitar a edição
let produtoEditandoId = null; // Avisa o sistema se estamos editando ou criando um novo

document.addEventListener('DOMContentLoaded', () => {
    listarVendas();
    carregarProdutos();
    carregarHistoricoFechamentos(); 
});

// ==========================================
// FUNÇÕES DO CARDÁPIO E EDIÇÃO
// ==========================================
async function carregarProdutos() {
    try {
        const response = await fetch(PRODUCTS_URL);
        if (!response.ok) return;
        produtosCadastrados = await response.json(); // Salva na memória
        
        const lista = document.getElementById('lista-produtos');
        if(lista) lista.innerHTML = '';
        
        produtosCadastrados.forEach(p => {
            const li = document.createElement('li');
            li.style.cssText = "display: flex; justify-content: space-between; padding: 12px 10px; border-bottom: 1px solid #eee; align-items: center; transition: 0.2s;";
            
            const categoriaFormatada = p.category ? p.category : 'Geral';
            
            li.innerHTML = `
                <span style="display: flex; align-items: center;">
                    <span style="background: #e9ecef; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-right: 12px; font-weight: bold; color: #495057;">${categoriaFormatada}</span>
                    <strong style="font-size: 15px;">${p.name}</strong> 
                    <span style="margin-left: 8px; color: #2e7d32; font-weight: bold;">- R$ ${p.price.toFixed(2)}</span>
                </span>
                <div style="display: flex; gap: 8px;">
                    <button onclick="prepararEdicao(${p.id})" style="background: #f57c00; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold; transition: 0.2s;">✏️ Editar</button>
                    <button onclick="excluirProduto(${p.id})" style="background: #d32f2f; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold; transition: 0.2s;">🗑️ Excluir</button>
                </div>
            `;
            if(lista) lista.appendChild(li);
        });
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
    }
}

// Prepara o formulário para receber a alteração
function prepararEdicao(id) {
    const produto = produtosCadastrados.find(p => p.id === id);
    if(!produto) return;

    // Preenche os campos com os dados antigos
    document.getElementById('nome-produto').value = produto.name;
    document.getElementById('preco-produto').value = produto.price;
    document.getElementById('categoria-produto').value = produto.category || '';
    
    // Altera o modo do sistema
    produtoEditandoId = id;
    
    // Muda o visual do botão
    const btnSubmit = document.querySelector('#form-produto button[type="submit"]');
    btnSubmit.innerHTML = '💾 Salvar Alteração';
    btnSubmit.style.background = '#f57c00';

    // Cria um botão de cancelar, se não existir
    if(!document.getElementById('btn-cancelar')) {
        const btnCancelar = document.createElement('button');
        btnCancelar.id = 'btn-cancelar';
        btnCancelar.type = 'button';
        btnCancelar.innerHTML = '❌ Cancelar';
        btnCancelar.style.cssText = "background: #757575; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;";
        btnCancelar.onclick = cancelarEdicao;
        document.getElementById('form-produto').appendChild(btnCancelar);
    }
    
    // Rola a tela para o topo suavemente
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancela a edição e volta o formulário ao normal
function cancelarEdicao() {
    produtoEditandoId = null;
    document.getElementById('form-produto').reset();
    
    const btnSubmit = document.querySelector('#form-produto button[type="submit"]');
    btnSubmit.innerHTML = '➕ Adicionar';
    btnSubmit.style.background = '#1565c0';
    
    const btnCancelar = document.getElementById('btn-cancelar');
    if(btnCancelar) btnCancelar.remove();
}

// O momento em que você clica no botão (Adicionar ou Salvar Alteração)
document.getElementById('form-produto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome-produto').value;
    const preco = document.getElementById('preco-produto').value;
    const categoria = document.getElementById('categoria-produto').value;

    const pacoteDeDados = { 
        name: nome, 
        price: parseFloat(preco),
        category: categoria 
    };

    try {
        let response;
        if (produtoEditandoId) {
            // MODO EDIÇÃO: Atualiza com a Chave Mestra
            response = await fetch(`${PRODUCTS_URL}/${produtoEditandoId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-token': SECRET_TOKEN // 🗝️ Chave aqui!
                },
                body: JSON.stringify(pacoteDeDados)
            });
            if (response.ok) cancelarEdicao();
        } else {
            // MODO CRIAÇÃO: Adiciona um novo com a Chave Mestra
            response = await fetch(PRODUCTS_URL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-token': SECRET_TOKEN // 🗝️ Chave aqui!
                },
                body: JSON.stringify(pacoteDeDados)
            });
            if (response.ok) document.getElementById('form-produto').reset();
        }
        
        if (!response.ok) {
            const erro = await response.json();
            alert(`Erro do Servidor: ${erro.error || 'Acesso Negado!'}`);
            return;
        }

        carregarProdutos(); // Recarrega a lista somente se deu certo
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Erro de comunicação com a Nuvem. Tente novamente.");
    }
});

// Exclusão protegida e com verificação visual
async function excluirProduto(id) {
    if(confirm("Tem certeza que deseja excluir este produto da nuvem?")) {
        try {
            const response = await fetch(`${PRODUCTS_URL}/${id}`, { 
                method: 'DELETE',
                headers: {
                    'x-admin-token': SECRET_TOKEN // 🗝️ Chave para liberar a exclusão na nuvem!
                }
            });

            if (response.ok) {
                carregarProdutos(); // Só apaga da tela se a nuvem autorizou e apagou de lá
            } else {
                const erro = await response.json();
                alert(`🚫 Não foi possível excluir: ${erro.error || 'Acesso Negado.'}`);
            }
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao conectar com o banco na nuvem.");
        }
    }
}

// ... DAQUI PARA BAIXO AS SUAS FUNÇÕES DE CAIXA E VENDAS CONTINUAM INTACTAS! ...

    const pacoteDeDados = { 
        name: nome, 
        price: parseFloat(preco),
        category: categoria 
    };

    if (produtoEditandoId) {
        // MODO EDIÇÃO: Atualiza o produto existente
        await fetch(`${PRODUCTS_URL}/${produtoEditandoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pacoteDeDados)
        });
        cancelarEdicao(); // Limpa e volta tudo ao normal
    } else {
        // MODO CRIAÇÃO: Adiciona um novo
        await fetch(PRODUCTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pacoteDeDados)
        });
        document.getElementById('form-produto').reset(); // Limpa os campos
    }
    
    carregarProdutos(); // Recarrega a lista
});

async function excluirProduto(id) {
    if(confirm("Tem certeza que deseja excluir este produto?")) {
        await fetch(`${PRODUCTS_URL}/${id}`, { method: 'DELETE' });
        carregarProdutos();
    }
}

// ==========================================
// FUNÇÕES DE VENDAS E CAIXA (MANTIDAS INTACTAS)
// ==========================================
async function listarVendas() {
    const response = await fetch(ORDERS_URL);
    const vendas = await response.json();
    const tbody = document.getElementById('orders-table-body');
    if(tbody) tbody.innerHTML = '';
    
    let faturamentoDinheiro = 0, faturamentoPix = 0, faturamentoCartao = 0, faturamentoTotal = 0;

    vendas.forEach(venda => {
        faturamentoTotal += venda.total;
        if (venda.payment_method === 'Dinheiro') faturamentoDinheiro += venda.total;
        else if (venda.payment_method === 'PIX') faturamentoPix += venda.total;
        else faturamentoCartao += venda.total;

        let itensFormatados = "";
        try {
            const itens = JSON.parse(venda.items);
            if(itens.length > 0 && itens[0].quantidade) {
                itensFormatados = itens.map(i => `${i.quantidade}x ${i.name}`).join(", ");
            } else {
                itensFormatados = itens.map(i => i.name).join(", ");
            }
        } catch (e) {
            itensFormatados = venda.items;
        }

        if(tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(venda.created_at).toLocaleString('pt-BR')}</td>
                <td>${itensFormatados}</td>
                <td>${venda.payment_method}</td>
                <td>R$ ${venda.total.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    const elTotal = document.getElementById('faturamento-total-valor');
    if(elTotal) elTotal.innerText = `R$ ${faturamentoTotal.toFixed(2)}`;
    
    const elDinheiro = document.getElementById('total-dinheiro');
    if(elDinheiro) elDinheiro.innerText = `R$ ${faturamentoDinheiro.toFixed(2)}`;
    
    const elPix = document.getElementById('total-pix');
    if(elPix) elPix.innerText = `R$ ${faturamentoPix.toFixed(2)}`;
    
    const elCartao = document.getElementById('total-cartao');
    if(elCartao) elCartao.innerText = `R$ ${faturamentoCartao.toFixed(2)}`;
}

async function abrirCaixa() {
    const valor = parseFloat(document.getElementById('valor-inicial').value) || 0;
    await fetch('/abrir-caixa', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ valorInicial: valor })});
    alert("Caixa aberto com sucesso!");
    location.reload();
}

async function fecharCaixa() {
    const valorInformadoNaGaveta = parseFloat(document.getElementById('valor-final').value) || 0;
    const valorInicialTroco = parseFloat(document.getElementById('valor-inicial').value) || 0;
    
    const textoTotal = document.getElementById('faturamento-total-valor').innerText.replace('R$ ', '').trim();
    const vendasDoDia = parseFloat(textoTotal) || 0;
    
    const totalEsperado = valorInicialTroco + vendasDoDia;
    const dataAtual = new Date().toLocaleString('pt-BR');

    const dadosFechamento = {
        data: dataAtual,
        valorInicial: valorInicialTroco,
        vendasDoDia: vendasDoDia,
        totalEsperado: totalEsperado,
        totalGaveta: valorInformadoNaGaveta
    };

    await fetch('/api/fechamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosFechamento)
    });

    const dif = valorInformadoNaGaveta - totalEsperado;
    
    const janelaImpressao = window.open('', '', 'width=400,height=600');
    janelaImpressao.document.write(`
        <html>
        <head>
            <title>Comprovante de Fechamento</title>
            <style>
                body { font-family: monospace; padding: 20px; color: #000; }
                h2 { text-align: center; margin-bottom: 5px; }
                p { text-align: center; margin-top: 0; margin-bottom: 20px; }
                .linha { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                .separador { border-top: 1px dashed #000; margin: 15px 0; }
                .resultado { font-size: 16px; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>FECHAMENTO DE CAIXA</h2>
            <p>${dataAtual}</p>
            <div class="separador"></div>
            <div class="linha"><span>Troco Inicial:</span> <span>R$ ${valorInicialTroco.toFixed(2)}</span></div>
            <div class="linha"><span>Vendas do Dia:</span> <span>R$ ${vendasDoDia.toFixed(2)}</span></div>
            <div class="linha"><span>Total Esperado:</span> <span>R$ ${totalEsperado.toFixed(2)}</span></div>
            <div class="linha"><span>Informado na Gaveta:</span> <span>R$ ${valorInformadoNaGaveta.toFixed(2)}</span></div>
            <div class="separador"></div>
            <div class="linha resultado">
                <span>Resultado:</span> 
                <span>${dif === 0 ? "BATEU CERTO" : (dif > 0 ? "SOBRA: R$ " + dif.toFixed(2) : "FALTA: R$ " + Math.abs(dif).toFixed(2))}</span>
            </div>
            <div class="separador"></div>
            <br><br><br>
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto; text-align: center; padding-top: 5px;">
                Assinatura do Responsável
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    
    document.getElementById('valor-final').value = '';
    carregarHistoricoFechamentos();
}

async function carregarHistoricoFechamentos() {
    const response = await fetch('/api/fechamentos');
    const fechamentos = await response.json();
    const tabela = document.getElementById('tabela-fechamentos');
    
    if (!tabela) return; 
    tabela.innerHTML = ''; 

    fechamentos.reverse().forEach(f => {
        const diferenca = f.totalGaveta - f.totalEsperado;
        let corDiferenca = 'green';
        if (diferenca < 0) corDiferenca = 'red'; 
        else if (diferenca > 0) corDiferenca = 'orange'; 

        tabela.innerHTML += `
            <tr>
                <td>${f.data}</td>
                <td>R$ ${f.valorInicial.toFixed(2)}</td>
                <td>R$ ${f.vendasDoDia.toFixed(2)}</td>
                <td>R$ ${f.totalEsperado.toFixed(2)}</td>
                <td>R$ ${f.totalGaveta.toFixed(2)}</td>
                <td style="color: ${corDiferenca}; font-weight: bold;">R$ ${diferenca.toFixed(2)}</td>
            </tr>
        `;
    });
}