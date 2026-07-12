let produtosTodos = []; 
let carrinho = [];      
let valorTotal = 0;
let categoriaAtual = 'Açaí'; 

document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();
});

async function carregarProdutos() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        produtosTodos = await response.json();
        renderizarProdutos();
    } catch (error) {
        console.error("Erro ao carregar cardápio:", error);
    }
}

function renderizarProdutos() {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const produtosFiltrados = produtosTodos.filter(p => {
        const catBanco = (p.category || '').toLowerCase().trim();
        const catAba = categoriaAtual.toLowerCase().trim();

        if (catAba === 'açaí' || catAba === 'açaís') {
            return catBanco === 'açaí' || catBanco === 'açaís' || catBanco === 'acai' || catBanco === 'acais';
        }
        if (catAba === 'cremes' || catAba === 'creme') {
            return catBanco === 'cremes' || catBanco === 'creme';
        }

        return catBanco === catAba;
    });

    if(produtosFiltrados.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #868e96; text-align: center; margin-top: 40px; font-size: 16px;">Nenhum produto cadastrado em <strong>${categoriaAtual}</strong>.</p>`;
        return;
    }

    produtosFiltrados.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'produto-btn';
        btn.innerHTML = `
            <span>${p.name}</span>
            <span class="price-tag">R$ ${p.price.toFixed(2)}</span>
        `;
        btn.onclick = () => adicionarAoCarrinho(p);
        grid.appendChild(btn);
    });
}

function filtrarCategoria(categoria) {
    categoriaAtual = categoria;
    const botoes = document.querySelectorAll('.tab-btn');
    botoes.forEach(btn => {
        const textoBotao = btn.innerText.toLowerCase();
        const catProcurada = categoria.toLowerCase();
        
        if(textoBotao.includes(catProcurada) || (catProcurada === 'açaí' && textoBotao.includes('açaí'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderizarProdutos();
}

function adicionarAoCarrinho(produto) {
    const itemExistente = carrinho.find(item => item.id === produto.id);
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({ 
            id: produto.id, 
            name: produto.name, 
            price: produto.price, 
            category: produto.category,
            quantidade: 1 
        });
    }
    atualizarCarrinho();
}

function removerDoCarrinho(id) {
    const itemIndex = carrinho.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        if (carrinho[itemIndex].quantidade > 1) {
            carrinho[itemIndex].quantidade -= 1;
        } else {
            carrinho.splice(itemIndex, 1);
        }
    }
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const lista = document.getElementById('cart-items');
    const elTotal = document.getElementById('cart-total-value');
    const elContagem = document.getElementById('itens-contagem');
    
    lista.innerHTML = '';
    let subtotal = 0;
    let totalItens = 0;
    
    let qtdAdicionais = 0;
    let qtdCoberturas = 0;
    
    carrinho.forEach(item => {
        const subtotalItem = item.price * item.quantidade;
        subtotal += subtotalItem;
        totalItens += item.quantidade;
        
        const cat = (item.category || '').toLowerCase();
        if (cat === 'adicionais') {
            qtdAdicionais += item.quantidade;
        } else if (cat === 'coberturas') {
            qtdCoberturas += item.quantidade;
        }
        
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-item-info">
                <span><span class="cart-item-qty">${item.quantidade}x</span><strong>${item.name}</strong></span>
                <span style="font-size: 12px; color: #868e96; margin-left: 32px;">Unid: R$ ${item.price.toFixed(2)}</span>
            </div>
            <div class="cart-item-controls">
                <span style="font-weight: bold; color: #495057;">R$ ${subtotalItem.toFixed(2)}</span>
                <button class="remover-btn" onclick="removerDoCarrinho(${item.id})">❌</button>
            </div>
        `;
        lista.appendChild(li);
    });
    
    let taxaAdicionaisExtra = 0;
    if (qtdAdicionais > 5) {
        taxaAdicionaisExtra = 2.00;
        const liTaxa = document.createElement('li');
        liTaxa.className = 'cart-item';
        liTaxa.style.color = '#e67e22';
        liTaxa.innerHTML = `
            <div class="cart-item-info">
                <span>⚠️ <strong>Taxa: Adicionais Excedidos (${qtdAdicionais}/5)</strong></span>
            </div>
            <div class="cart-item-controls"><span style="font-weight: bold;">R$ 2.00</span></div>
        `;
        lista.appendChild(liTaxa);
    }

    let taxaCoberturasExtra = 0;
    if (qtdCoberturas > 2) {
        taxaCoberturasExtra = 2.00;
        const liTaxaCob = document.createElement('li');
        liTaxaCob.className = 'cart-item';
        liTaxaCob.style.color = '#e67e22';
        liTaxaCob.innerHTML = `
            <div class="cart-item-info">
                <span>⚠️ <strong>Taxa: Coberturas Excedidas (${qtdCoberturas}/2)</strong></span>
            </div>
            <div class="cart-item-controls"><span style="font-weight: bold;">R$ 2.00</span></div>
        `;
        lista.appendChild(liTaxaCob);
    }
    
    const taxaEntrega = parseFloat(document.getElementById('taxa-entrega')?.value) || 0;
    valorTotal = subtotal + taxaEntrega + taxaAdicionaisExtra + taxaCoberturasExtra;
    
    if(elTotal) elTotal.innerText = `R$ ${valorTotal.toFixed(2)}`;
    if(elContagem) elContagem.innerText = `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`;
}

// GERADOR DE CUPOM / NOTA FISCAL PARA IMPRESSÃO
function imprimirComprovante(itensPedido, totalPedido, metodo, trocoMsg, taxaEntrega) {
    const janelaPrint = window.open('', '_blank', 'width=350,height=600');
    const dataHora = new Date().toLocaleString('pt-BR');
    
    let html = `
    <html>
    <head>
        <title>Comprovante - Meu Cantinho Açaí</title>
        <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 15px; width: 280px; color: #000; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; }
            .item { display: flex; justify-content: space-between; margin: 4px 0; }
            .total-section { border-top: 1px dashed #000; margin-top: 10px; padding-top: 8px; font-weight: bold; }
            .footer { text-align: center; margin-top: 15px; font-size: 11px; border-top: 1px dashed #000; padding-top: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">MEU CANTINHO AÇAÍ</div>
            <div>Comprovante de Pedido</div>
            <div style="font-size: 10px; margin-top: 4px;">${dataHora}</div>
        </div>
        <div>
    `;
    
    itensPedido.forEach(i => {
        html += `
            <div class="item">
                <span>${i.quantidade}x ${i.name}</span>
                <span>R$ ${(i.price * i.quantidade).toFixed(2)}</span>
            </div>
        `;
    });

    if (taxaEntrega > 0) {
        html += `
            <div class="item">
                <span>🛵 Taxa de Entrega</span>
                <span>R$ ${taxaEntrega.toFixed(2)}</span>
            </div>
        `;
    }

    html += `
        </div>
        <div class="total-section">
            <div class="item" style="font-size: 14px;">
                <span>TOTAL:</span>
                <span>R$ ${totalPedido.toFixed(2)}</span>
            </div>
            <div class="item">
                <span>Forma de Pagto:</span>
                <span>${metodo}</span>
            </div>
            ${trocoMsg ? `<div style="margin-top: 6px; font-size: 11px; font-weight: normal; white-space: pre-line;">${trocoMsg.trim()}</div>` : ''}
        </div>
        <div class="footer">
            Obrigado pela preferência!<br>Volte sempre! 💜
        </div>
        <script>
            window.onload = function() { 
                window.print(); 
                // Opcional: window.close() após imprimir;
            }
        </script>
    </body>
    </html>
    `;
    
    janelaPrint.document.write(html);
    janelaPrint.document.close();
}

// FINALIZAR PEDIDO E EMITIR COMPROVANTE
async function finalizarVenda(metodoPagamento) {
    if (carrinho.length === 0) {
        alert('⚠️ Selecione pelo menos um produto antes de finalizar a venda!');
        return;
    }

    let mensagemTroco = '';

    if (metodoPagamento === 'Dinheiro') {
        const inputValor = prompt(`💳 Total a Pagar: R$ ${valorTotal.toFixed(2)}\n\nO cliente vai pagar com qual valor?`);
        if (inputValor === null) return; 

        if (inputValor.trim() !== "") {
            const valorRecebido = parseFloat(inputValor.replace(',', '.')); 
            if (valorRecebido < valorTotal) {
                alert(`❌ Valor insuficiente! Faltam R$ ${(valorTotal - valorRecebido).toFixed(2)}.`);
                return;
            }
            const troco = valorRecebido - valorTotal;
            if (troco > 0) {
                mensagemTroco = `Mandar Troco Para: R$ ${valorRecebido.toFixed(2)}\nValor do Troco: R$ ${troco.toFixed(2)}`;
            } else {
                mensagemTroco = `Valor exato (Sem troco).`;
            }
        }
    }

    try {
        const taxaEntrega = parseFloat(document.getElementById('taxa-entrega')?.value) || 0;
        const itensParaO_Banco = [...carrinho]; 
        
        if (taxaEntrega > 0) {
            itensParaO_Banco.push({ name: '🛵 Taxa de Entrega', price: taxaEntrega, quantidade: 1 });
        }

        let qtdAdicionais = 0;
        let qtdCoberturas = 0;
        carrinho.forEach(i => {
            const cat = (i.category || '').toLowerCase();
            if (cat === 'adicionais') qtdAdicionais += i.quantidade;
            if (cat === 'coberturas') qtdCoberturas += i.quantidade;
        });

        if (qtdAdicionais > 5) itensParaO_Banco.push({ name: '⚠️ Taxa Adicionais Excedidos', price: 2.00, quantidade: 1 });
        if (qtdCoberturas > 2) itensParaO_Banco.push({ name: '⚠️ Taxa Coberturas Excedidas', price: 2.00, quantidade: 1 });

        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: JSON.stringify(itensParaO_Banco),
                total: valorTotal,
                payment_method: metodoPagamento
            })
        });

        if (response.ok) {
            // GERA E IMPRIME O COMPROVANTE NA HORA
            imprimirComprovante(carrinho, valorTotal, metodoPagamento, mensagemTroco, taxaEntrega);

            carrinho = [];
            if(document.getElementById('taxa-entrega')) document.getElementById('taxa-entrega').value = '0.00';
            atualizarCarrinho();
        } else {
            alert('Falha ao salvar a venda no servidor.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão com o servidor.');
    }
}
/* ==========================================================================
   --- LÓGICA DO PAINEL ADMINISTRATIVO E CONTROLE DE CAIXA ---
   ========================================================================== */

// Variáveis de Estado do Caixa (Armazenadas no navegador para não sumir ao atualizar)
let caixaAberto = localStorage.getItem('caixa_aberto') === 'true';
let fundoDeTroco = parseFloat(localStorage.getItem('caixa_fundo')) || 0;
let totalVendasDia = parseFloat(localStorage.getItem('caixa_vendas')) || 0;

// Inicialização do Painel Administrativo
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('lista-produtos')) {
        carregarProdutosAdmin();
        atualizarTelaCaixa();
    }
});

// 1. CARREGAR E EXIBIR PRODUTOS CADASTRADOS (COM VISUAL MODERNO)
async function carregarProdutosAdmin() {
    const lista = document.getElementById('lista-produtos');
    if (!lista) return;

    try {
        const response = await fetch('http://localhost:3000/api/products');
        const produtos = await response.json();
        
        lista.innerHTML = '';

        if (produtos.length === 0) {
            lista.innerHTML = `<div style="padding: 20px; text-align: center; color: #868e96;">Nenhum produto cadastrado no momento.</div>`;
            return;
        }

        produtos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'item-produto-admin';
            div.innerHTML = `
                <div>
                    <strong style="font-size: 15px; color: #343a40;">${p.name}</strong>
                    <span class="badge-cat">${p.category || 'Geral'}</span>
                    <div style="font-size: 13px; color: #2b9348; font-weight: bold; margin-top: 4px;">R$ ${p.price.toFixed(2)}</div>
                </div>
                <div>
                    <button onclick="editarProduto(${p.id}, '${p.name}', ${p.price})" style="background:#ffc107; color:#000; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer; margin-right:5px;">✏️ Editar</button>
                    <button onclick="excluirProduto(${p.id})" style="background:#dc3545; color:white; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">🗑️ Excluir</button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error("Erro ao carregar admin:", error);
        lista.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545;">Erro ao conectar com o servidor para listar produtos.</div>`;
    }
}

// 2. FUNÇÕES DE ABERTURA E FECHAMENTO DE CAIXA
function atualizarTelaCaixa() {
    const statusBox = document.getElementById('status-caixa-box');
    const areaAbertura = document.getElementById('area-abertura-caixa');
    const areaAberto = document.getElementById('area-caixa-aberto');
    
    if (!statusBox || !areaAbertura || !areaAberto) return;

    if (caixaAberto) {
        statusBox.className = 'caixa-status-box caixa-aberto';
        statusBox.innerHTML = '🟢 CAIXA ABERTO';
        areaAbertura.style.display = 'none';
        areaAberto.style.display = 'block';

        // Atualiza os valores na tela
        document.getElementById('exibe-fundo-troco').innerText = `R$ ${fundoDeTroco.toFixed(2)}`;
        document.getElementById('exibe-vendas-dia').innerText = `R$ ${totalVendasDia.toFixed(2)}`;
        document.getElementById('exibe-total-caixa').innerText = `R$ ${(fundoDeTroco + totalVendasDia).toFixed(2)}`;
    } else {
        statusBox.className = 'caixa-status-box caixa-fechado';
        statusBox.innerHTML = '🔴 CAIXA FECHADO';
        areaAbertura.style.display = 'block';
        areaAberto.style.display = 'none';
    }
}

function abrirCaixa() {
    const inputSaldo = document.getElementById('saldo-inicial');
    const valor = parseFloat(inputSaldo.value) || 0;

    fundoDeTroco = valor;
    caixaAberto = true;
    
    // Salva na memória do navegador
    localStorage.setItem('caixa_aberto', 'true');
    localStorage.setItem('caixa_fundo', fundoDeTroco.toString());
    
    atualizarTelaCaixa();
    alert(`🔓 Caixa aberto com sucesso! Fundo de troco: R$ ${fundoDeTroco.toFixed(2)}`);
}

function fecharCaixa() {
    if (!confirm("Tem certeza que deseja fechar o caixa do dia? Certifique-se de ter conferido os valores da gaveta!")) {
        return;
    }

    const totalFinal = fundoDeTroco + totalVendasDia;
    
    // Alerta de resumo antes de fechar
    alert(`🔒 FECHAMENTO DE CAIXA CONCLUÍDO!\n\n💵 Fundo de Troco: R$ ${fundoDeTroco.toFixed(2)}\n🛒 Vendas do Dia: R$ ${totalVendasDia.toFixed(2)}\n💰 Total em Gaveta Esperado: R$ ${totalFinal.toFixed(2)}`);

    // Reseta o caixa
    caixaAberto = false;
    fundoDeTroco = 0;
    
    // Opção: Pode zerar as vendas do dia ao fechar o caixa ou manter
    // totalVendasDia = 0; 
    
    localStorage.setItem('caixa_aberto', 'false');
    localStorage.setItem('caixa_fundo', '0');
    
    atualizarTelaCaixa();
}

// 3. RELATÓRIO DE FECHAMENTO PARA IMPRESSÃO
function imprimirRelatorioCaixa() {
    const janelaPrint = window.open('', '_blank', 'width=350,height=600');
    const dataHora = new Date().toLocaleString('pt-BR');
    const totalGaveta = fundoDeTroco + totalVendasDia;
    
    const html = `
    <html>
    <head>
        <title>Relatório de Caixa - Meu Cantinho Açaí</title>
        <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 15px; width: 280px; color: #000; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .title { font-size: 15px; font-weight: bold; }
            .item { display: flex; justify-content: space-between; margin: 6px 0; }
            .total-section { border-top: 1px dashed #000; margin-top: 12px; padding-top: 8px; font-weight: bold; font-size: 14px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">MEU CANTINHO AÇAÍ</div>
            <div>RELATÓRIO DE GESTÃO DE CAIXA</div>
            <div style="font-size: 10px; margin-top: 4px;">Emissão: ${dataHora}</div>
        </div>
        <div>
            <div class="item">
                <span>Status Atual:</span>
                <span>${caixaAberto ? 'ABERTO' : 'FECHADO'}</span>
            </div>
            <div class="item">
                <span>Fundo de Troco:</span>
                <span>R$ ${fundoDeTroco.toFixed(2)}</span>
            </div>
            <div class="item">
                <span>Vendas do Dia:</span>
                <span>R$ ${totalVendasDia.toFixed(2)}</span>
            </div>
        </div>
        <div class="total-section">
            <div class="item">
                <span>TOTAL GAVETA:</span>
                <span>R$ ${totalGaveta.toFixed(2)}</span>
            </div>
        </div>
        <div class="footer">
            Assinatura do Responsável:<br><br>
            ____________________________
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;
    
    janelaPrint.document.write(html);
    janelaPrint.document.close();
}

// 4. FUNÇÕES DE SUPORTE A PRODUTOS (ADICIONAR/EXCLUIR)
async function adicionarProduto() {
    const nome = document.getElementById('nome-produto')?.value;
    const categoria = document.getElementById('categoria-produto')?.value;
    const preco = parseFloat(document.getElementById('preco-produto')?.value);

    if (!nome || !categoria || isNaN(preco)) {
        alert("⚠️ Preencha todos os campos corretamente!");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nome, category: categoria, price: preco })
        });

        if (response.ok) {
            alert("✅ Produto adicionado com sucesso!");
            document.getElementById('nome-produto').value = '';
            document.getElementById('preco-produto').value = '';
            document.getElementById('categoria-produto').value = '';
            carregarProdutosAdmin();
        } else {
            alert("Erro ao adicionar no servidor.");
        }
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro de conexão com o servidor.");
    }
}

async function excluirProduto(id) {
    if (confirm("⚠️ Tem certeza que deseja excluir este item do cardápio?")) {
        try {
            const response = await fetch(`http://localhost:3000/api/products/${id}`, { method: 'DELETE' });
            if (response.ok) {
                carregarProdutosAdmin();
            } else {
                alert("Não foi possível remover o item do servidor.");
            }
        } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao conectar com o servidor para excluir.");
        }
    }
}

function editarProduto(id, nomeAtual, precoAtual) {
    const novoNome = prompt("Editar Nome do Produto:", nomeAtual);
    if (novoNome === null) return;
    
    const novoPrecoStr = prompt("Editar Preço (R$):", precoAtual.toFixed(2));
    if (novoPrecoStr === null) return;
    
    const novoPreco = parseFloat(novoPrecoStr.replace(',', '.'));
    if (isNaN(novoPreco)) {
        alert("Preço inválido!");
        return;
    }

    // Exemplo de atualização no backend (Requer rota PUT no seu servidor)
    fetch(`http://localhost:3000/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: novoNome, price: novoPreco })
    }).then(res => {
        if(res.ok) {
            alert("✅ Produto atualizado!");
            carregarProdutosAdmin();
        } else {
            alert("Não foi possível atualizar (verifique se sua API suporta edição PUT).");
        }
    }).catch(err => console.error(err));
}