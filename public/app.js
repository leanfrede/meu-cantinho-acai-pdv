// ==========================================================================
// VARIÁVEIS GLOBAIS DO SISTEMA
// ==========================================================================
let produtosTodos = [];
let carrinho = [];
let categoriaAtual = 'Açaí';
let produtoSendoConfigurado = null;
let totalVendaAtual = 0;
let totalItensCarrinho = 0;
let ultimoPedidoSalvo = null;

let caixaAberto = localStorage.getItem('caixa_aberto') === 'true';
let fundoDeTroco = parseFloat(localStorage.getItem('caixa_fundo')) || 0;

// CONFIGURAÇÃO DOS DOIS SÓCIOS E SEUS PINS INDIVIDUAIS
const DICIONARIO_SOCIOS = {
    "1111": "Sócio A",
    "2222": "Sócio B"
};
let pinDigitado = "";

function formatarDataHora(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// ==========================================================================
// CONFIGURAÇÃO DOS ATALHOS DE TECLADO
// ==========================================================================
document.addEventListener('keydown', (event) => {
    if (!document.getElementById('product-grid')) return;
    if (event.key === 'F2') { event.preventDefault(); finalizarVenda(); }
    if (event.key === 'Escape') { event.preventDefault(); fecharModal(); fecharModalPagamento(); fecharModalSucesso(); }
});

// ==========================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-grid')) carregarProdutos();
    
    if (document.getElementById('lista-produtos')) {
        if (sessionStorage.getItem('admin_autenticado') === 'true') {
            liberarPainelAdmin();
        } else {
            document.getElementById('tela-bloqueio-admin').style.display = 'flex';
            document.getElementById('painel-conteudo-protegido').style.display = 'none';
        }
    }

    if (document.getElementById('panel-cozinha')) {
        carregarPedidosCozinha();
        setInterval(carregarPedidosCozinha, 4000);
    }
});

// ==========================================================================
// LÓGICA DE LOGIN POR PIN MULTI-SÓCIO
// ==========================================================================
function digitarPin(numero) {
    if (pinDigitado.length >= 4) return;
    pinDigitado += numero;
    document.getElementById('pin-visor').innerText = "•".repeat(pinDigitado.length);

    if (pinDigitado.length === 4) {
        setTimeout(verificarPin, 200);
    }
}

function limparPin() {
    pinDigitado = "";
    document.getElementById('pin-visor').innerText = "";
}

function verificarPin() {
    if (DICIONARIO_SOCIOS[pinDigitado]) {
        const socioNome = DICIONARIO_SOCIOS[pinDigitado];
        sessionStorage.setItem('admin_autenticado', 'true');
        sessionStorage.setItem('admin_usuario', socioNome);
        liberarPainelAdmin();
    } else {
        alert("❌ PIN Incorreto! Acesso negado.");
        limparPin();
    }
}

function liberarPainelAdmin() {
    document.getElementById('tela-bloqueio-admin').style.display = 'none';
    document.getElementById('painel-conteudo-protegido').style.display = 'block';

    const elSocio = document.getElementById('nome-socio-logado');
    if (elSocio) elSocio.innerText = sessionStorage.getItem('admin_usuario');

    carregarProdutosAdmin();
    carregarHistoricoVendas();
    carregarMovimentacoesCaixa();
    atualizarTelaCaixa();
}

function fazerLogoutAdmin() {
    sessionStorage.removeItem('admin_autenticado');
    sessionStorage.removeItem('admin_usuario');
    window.location.reload();
}

function sairParaCaixa() { window.location.href = "index.html"; }

// ==========================================================================
// FRENTE DE CAIXA (VENDAS)
// ==========================================================================
async function carregarProdutos() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        produtosTodos = await response.json();
        renderizarProdutos();
    } catch (error) { console.error("Erro ao carregar produtos:", error); }
}

function renderizarProdutos() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const produtosFiltrados = produtosTodos.filter(p => {
        const catBanco = (p.category || '').toLowerCase().trim();
        const catAba = categoriaAtual.toLowerCase().trim();
        if (catAba === 'açaí' || catAba === 'açaís') return catBanco === 'açaí' || catBanco === 'açaís' || catBanco === 'acai' || catBanco === 'acais';
        if (catAba === 'cremes' || catAba === 'creme') return catBanco === 'cremes' || catBanco === 'creme';
        return catBanco === catAba;
    });

    if (produtosFiltrados.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; color: #868e96; text-align: center; margin-top: 20px;">Nenhum produto em <strong>${categoriaAtual}</strong>.</p>`;
        return;
    }

    produtosFiltrados.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'produto-btn';
        const disponivel = p.available !== false;

        if (!disponivel) {
            btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; btn.style.border = '2px dashed #dc3545';
            btn.innerHTML = `<span>${p.name}<br><small style="color:#dc3545; font-weight:bold; font-size:11px;">⚠️ ESGOTADO</small></span><span class="price-tag" style="background:#6c757d; color:white;">R$ ${p.price.toFixed(2)}</span>`;
            btn.onclick = () => alert(`⚠️ Desculpe! O ingrediente ou tamanho "${p.name}" acabou no estoque.`);
        } else {
            btn.innerHTML = `<span>${p.name}</span><span class="price-tag">R$ ${p.price.toFixed(2)}</span>`;
            btn.onclick = () => abrirModal(p);
        }
        grid.appendChild(btn);
    });
}

function filtrarCategoria(categoria) {
    categoriaAtual = categoria;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.innerText.toLowerCase().includes(categoria.toLowerCase())) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderizarProdutos();
}

// O MONTADOR (MODAL DE PERSONALIZAÇÃO)
function abrirModal(produto) {
    produtoSendoConfigurado = produto;
    const modalTitulo = document.getElementById('modal-titulo');
    if (modalTitulo) modalTitulo.innerText = `Personalizar: ${produto.name}`;
    document.querySelectorAll('#modal-conteudo input[type="checkbox"]').forEach(cb => cb.checked = false);
    const modalDiv = document.getElementById('modal-produto');
    if (modalDiv) modalDiv.style.display = 'flex';
}

function fecharModal() { const modalDiv = document.getElementById('modal-produto'); if (modalDiv) modalDiv.style.display = 'none'; }

function confirmarAdicao() {
    const coberturas = Array.from(document.querySelectorAll('input[name="cobertura"]:checked')).map(cb => cb.value);
    const acompanhamentos = Array.from(document.querySelectorAll('input[name="acompanhamento"]:checked')).map(cb => cb.value);

    if (coberturas.length > 2) { alert("⚠️ Escolha no máximo 2 Coberturas."); return; }
    if (acompanhamentos.length > 5) { alert("⚠️ Escolha no máximo 5 Acompanhamentos."); return; }

    let observacao = "";
    if (coberturas.length > 0) observacao += `Coberturas: ${coberturas.join(', ')}`;
    if (acompanhamentos.length > 0) observacao += (observacao ? ' | ' : '') + `Acomps: ${acompanhamentos.join(', ')}`;
    if (!observacao) observacao = "Copos simples tradicional";

    carrinho.push({ id: produtoSendoConfigurado.id, name: produtoSendoConfigurado.name, price: produtoSendoConfigurado.price, obs: observacao });
    atualizarCarrinhoUI();
    fecharModal();
}

function atualizarCarrinhoUI() {
    const lista = document.getElementById('cart-items');
    const elTotal = document.getElementById('total-price');
    const elContagem = document.getElementById('itens-contagem');
    if (!lista) return;
    lista.innerHTML = '';
    let subtotal = 0;

    carrinho.forEach((item, index) => {
        subtotal += item.price;
        const div = document.createElement('div');
        div.className = 'cart-item-row';
        div.innerHTML = `
            <div class="cart-item-info"><strong>1x ${item.name}</strong><small>${item.obs}</small></div>
            <div class="cart-item-right"><span>R$ ${item.price.toFixed(2)}</span><button class="btn-remover-item" onclick="removerDoCarrinho(${index})">❌</button></div>
        `;
        lista.appendChild(div);
    });
    if (elTotal) elTotal.innerText = `R$ ${subtotal.toFixed(2)}`;
    if (elContagem) elContagem.innerText = `${carrinho.length} ${carrinho.length === 1 ? 'item' : 'itens'}`;
}

function removerDoCarrinho(index) { carrinho.splice(index, 1); atualizarCarrinhoUI(); }

function finalizarVenda() {
    if (carrinho.length === 0) { alert('⚠️ O carrinho está vazio!'); return; }
    const valorTotalStr = document.getElementById('total-price').innerText.replace('R$', '').trim();
    totalItensCarrinho = parseFloat(valorTotalStr);
    totalVendaAtual = totalItensCarrinho;

    document.getElementById('pedido-tipo').value = 'Balcão';
    document.getElementById('taxa-entrega').value = '';
    document.getElementById('div-taxa-entrega').style.display = 'none';
    document.getElementById('modal-pagamento-total').innerText = `R$ ${totalVendaAtual.toFixed(2)}`;
    document.getElementById('pagamento-metodo').value = 'Dinheiro';
    document.getElementById('pagamento-recebido').value = '';
    document.getElementById('pagamento-troco').innerText = 'R$ 0.00';
    document.getElementById('div-calculo-troco').style.display = 'block';
    document.getElementById('modal-pagamento').style.display = 'flex';
}

function fecharModalPagamento() { document.getElementById('modal-pagamento').style.display = 'none'; }

function alternarTipoPedido() {
    const tipo = document.getElementById('pedido-tipo').value;
    const divTaxa = document.getElementById('div-taxa-entrega');
    if (tipo === 'Entrega') divTaxa.style.display = 'block';
    else { divTaxa.style.display = 'none'; document.getElementById('taxa-entrega').value = ''; }
    calcularTotalComEntrega();
}

function calcularTotalComEntrega() {
    const taxa = parseFloat(document.getElementById('taxa-entrega').value) || 0;
    totalVendaAtual = totalItensCarrinho + taxa;
    document.getElementById('modal-pagamento-total').innerText = `R$ ${totalVendaAtual.toFixed(2)}`;
    calcularTroco();
}

function alternarCampoTroco() {
    const metodo = document.getElementById('pagamento-metodo').value;
    const divTroco = document.getElementById('div-calculo-troco');
    if (metodo === 'Dinheiro') divTroco.style.display = 'block';
    else divTroco.style.display = 'none';
}

function calcularTroco() {
    const recebido = parseFloat(document.getElementById('pagamento-recebido').value) || 0;
    const troco = recebido - totalVendaAtual;
    const elTroco = document.getElementById('pagamento-troco');
    if (troco < 0) { elTroco.innerText = "Valor insuficiente"; elTroco.style.color = "#c92a2a"; }
    else { elTroco.innerText = `R$ ${troco.toFixed(2)}`; elTroco.style.color = "#2b8a3e"; }
}

async function confirmarVendaComPagamento() {
    const metodo = document.getElementById('pagamento-metodo').value;
    const recebido = parseFloat(document.getElementById('pagamento-recebido').value) || 0;
    const tipoPed = document.getElementById('pedido-tipo').value;
    const taxaPed = parseFloat(document.getElementById('taxa-entrega').value) || 0;

    if (metodo === 'Dinheiro' && recebido < totalVendaAtual) { alert("⚠️ O valor entregue é insuficiente!"); return; }

    const troco = metodo === 'Dinheiro' ? (recebido - totalVendaAtual) : 0;
    const dadosVenda = {
        itens: carrinho, total: totalVendaAtual, formaPagamento: metodo,
        valorRecebido: metodo === 'Dinheiro' ? recebido : totalVendaAtual, troco: troco,
        tipoPedido: tipoPed, taxaEntrega: taxaPed, data: new Date().toISOString()
    };

    try {
        const response = await fetch('http://localhost:3000/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosVenda) });
        if (response.ok) {
            ultimoPedidoSalvo = await response.json();
            carrinho = []; atualizarCarrinhoUI(); fecharModalPagamento();
            document.getElementById('whatsapp-cliente').value = '';
            document.getElementById('modal-sucesso').style.display = 'flex';
        }
    } catch (error) { console.error(error); }
}

function fecharModalSucesso() { document.getElementById('modal-sucesso').style.display = 'none'; ultimoPedidoSalvo = null; }

function enviarCupomWhatsApp() {
    if (!ultimoPedidoSalvo) return;
    let fone = document.getElementById('whatsapp-cliente').value.replace(/\D/g, '');
    if (!fone || fone.length < 10) { alert("⚠️ Digite um número válido com DDD!"); return; }
    if (fone.length === 10 || fone.length === 11) fone = '55' + fone;

    let msg = `*🔮 MEU CANTINHO AÇAÍ* \n-----------------------------\n*COMPROVANTE DE COMPRA*\n*Pedido:* #${ultimoPedidoSalvo.id} (${ultimoPedidoSalvo.tipoPedido})\n*Data:* ${new Date(ultimoPedidoSalvo.data).toLocaleString('pt-BR')}\n-----------------------------\n`;
    ultimoPedidoSalvo.itens.forEach(i => { msg += `• *1x ${i.name}*\n  _${i.obs}_\n  R$ ${i.price.toFixed(2)}\n\n`; });
    msg += `-----------------------------\n`;
    if (ultimoPedidoSalvo.tipoPedido === 'Entrega') msg += `*Taxa de Entrega:* R$ ${ultimoPedidoSalvo.taxaEntrega.toFixed(2)}\n`;
    msg += `*Forma de Pagto:* ${ultimoPedidoSalvo.formaPagamento}\n`;
    if (ultimoPedidoSalvo.formaPagamento === 'Dinheiro') msg += `*Valor Entregue:* R$ ${ultimoPedidoSalvo.valorRecebido.toFixed(2)}\n*Troco Devolvido:* R$ ${ultimoPedidoSalvo.troco.toFixed(2)}\n`;
    msg += `*VALOR TOTAL: R$ ${ultimoPedidoSalvo.total.toFixed(2)}*\n-----------------------------\n_Obrigado pela preferência! Volte sempre!_ ✨🍧`;
    window.open(`https://api.whatsapp.com/send?phone=${fone}&text=${encodeURIComponent(msg)}`, '_blank');
}

async function registrarMovimentacao(tipo) {
    const valorInput = prompt(`💰 Digite o valor para a ${tipo.toUpperCase()}:`);
    if (!valorInput) return;
    const valor = parseFloat(valorInput.replace(',', '.'));
    const motivo = prompt(`📝 Qual o motivo?`);
    if (!motivo) return;
    
    const socioResponsavel = sessionStorage.getItem('admin_usuario') || 'Balcão';

    try {
        await fetch('http://localhost:3000/api/caixa', { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'X-Usuario': socioResponsavel
            }, 
            body: JSON.stringify({ tipo, valor, motivo, data: new Date().toISOString() }) 
        });
        alert(`✅ Registrado com sucesso!`);
    } catch (error) { console.error(error); }
}

// ==========================================================================
// MONITOR DE PEDIDOS DA COZINHA (KDS TRADICIONAL)
// ==========================================================================
async function carregarPedidosCozinha() {
    const painel = document.getElementById('panel-cozinha');
    const contador = document.getElementById('cozinha-contador');
    if (!painel) return;

    try {
        const response = await fetch('http://localhost:3000/api/orders');
        const pedidos = await response.json();
        
        const hoje = new Date().toISOString().split('T')[0];
        const filaPendente = pedidos.filter(o => o.data.startsWith(hoje) && o.status === 'Pendente');

        if (contador) contador.innerText = `${filaPendente.length} ${filaPendente.length === 1 ? 'Pedido na Fila' : 'Pedidos na Fila'}`;
        painel.innerHTML = '';

        if (filaPendente.length === 0) {
            painel.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#868e96; font-size:18px;">✨ Nossos clientes já estão de barriga cheia!<br>Nenhum pedido na fila de montagem.</div>`;
            return;
        }

        filaPendente.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card-pedido-cozinha';
            const badgeClass = p.tipoPedido === 'Entrega' ? 'pedido-badge-entrega' : 'pedido-badge-balcao';
            const badgeTexto = p.tipoPedido === 'Entrega' ? '🛵 ENTREGA' : '🏪 BALCÃO';

            let itensHtml = '';
            p.itens.forEach(i => { itensHtml += `<div class="item-linha-cozinha"><strong>📦 1x ${i.name}</strong><p>📋 ${i.obs}</p></div>`; });

            const horaPedido = new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div>
                    <div class="pedido-topo"><span style="font-weight:bold; font-size:16px;">Comanda #${p.id}</span><span class="${badgeClass}">${badgeTexto}</span></div>
                    <div style="font-size:13px; color:#868e96; margin-bottom:12px;">⏰ Recebido às: ${horaPedido}</div>
                    <div class="pedido-corpo-itens">${itensHtml}</div>
                </div>
                <button class="btn-pronto" onclick="concluirPreparoCozinha(${p.id})">✔ CONCLUÍDO / PRONTO</button>
            `;
            painel.appendChild(card);
        });
    } catch (error) { console.error("Erro no painel da cozinha:", error); }
}

async function concluirPreparoCozinha(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Pronto' }) });
        if (response.ok) carregarPedidosCozinha();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// PAINEL ADMINISTRATIVO AUDITADO (AUDITORIA POR SÓCIO COM DATA E HORA)
// ==========================================================================
async function carregarProdutosAdmin() {
    const lista = document.getElementById('lista-produtos');
    if (!lista) return;
    try {
        const response = await fetch('http://localhost:3000/api/products');
        const produtos = await response.json();
        lista.innerHTML = '';
        produtos.forEach(p => {
            const disponivel = p.available !== false;
            const statusTexto = disponivel ? '🟢 Ativo' : '🔴 Esgotado';
            const statusCor = disponivel ? '#2b9348' : '#dc3545';
            const div = document.createElement('div');
            
            const dataStr = p.dataAtividade ? ` em ${formatarDataHora(p.dataAtividade)}` : '';
            const responsavelStr = p.usuarioAtividade ? `(Modificado por: ${p.usuarioAtividade}${dataStr})` : '';

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <div>
                        <strong>${p.name}</strong> <span style="font-size:11px; background:#eeb4ff; padding:2px 6px; border-radius:10px;">${p.category}</span>
                        <div style="font-size:12px; color:#666;">R$ ${p.price.toFixed(2)} <br><span style="color:#0077b6; font-weight:bold; font-size:11px;">${responsavelStr}</span></div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button onclick="alternarStatusProduto(${p.id}, ${disponivel})" style="background:${statusCor}; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">${statusTexto}</button>
                        <button onclick="editarProduto(${p.id}, '${p.name}', ${p.price})" style="background:#ffc107; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button onclick="excluirProduto(${p.id})" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
            lista.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function alternarStatusProduto(id, statusAtual) {
    try {
        const response = await fetch(`http://localhost:3000/api/products/${id}`, { 
            method: 'PUT', 
            headers: { 
                'Content-Type': 'application/json',
                'X-Usuario': sessionStorage.getItem('admin_usuario')
            }, 
            body: JSON.stringify({ available: !statusAtual }) 
        });
        if (response.ok) carregarProdutosAdmin();
    } catch (error) { console.error(error); }
}

async function carregarHistoricoVendas() {
    const lista = document.getElementById('historico-vendas');
    if (!lista) return;
    try {
        const res = await fetch('http://localhost:3000/api/orders');
        const orders = await res.json();
        const hoje = new Date().toISOString().split('T')[0];
        const ordHoje = orders.filter(o => o.data.startsWith(hoje));

        lista.innerHTML = '';
        if (ordHoje.length === 0) { lista.innerHTML = '<div style="padding:15px; color:#868e96;">Nenhuma venda realizada hoje.</div>'; return; }
        
        ordHoje.reverse().forEach(o => {
            const div = document.createElement('div');
            div.style = "padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
            const lblEntrega = o.tipoPedido === 'Entrega' ? '🛵' : '🏪';
            
            let statusBadge = `<span style="font-size:12px; font-weight:bold; color:${o.status === 'Pronto' ? '#2b9348' : '#ffc107'}">${(o.status || 'Pendente').toUpperCase()}</span>`;
            let corTotal = '#2b9348';
            let botoesAcao = `
                <button onclick="reimprimirCupomCliente(${o.id})" style="background:none; border:none; cursor:pointer; font-size:14px;">🖨️</button>
                <button onclick="cancelarVendaAdmin(${o.id})" style="background:none; border:none; cursor:pointer; font-size:14px; margin-left:8px;">🗑️</button>
            `;

            if (o.status === 'Cancelado') {
                const dataCancelado = o.canceladoEm ? ` às ${formatarDataHora(o.canceladoEm).split(' ')[1]}` : '';
                const motivoStr = o.motivoCancelamento ? `<br><span style="color:#c92a2a; font-size:11px;"><b>Motivo:</b> ${o.motivoCancelamento}</span>` : '';
                statusBadge = `<span style="font-size:11px; font-weight:bold; color:#dc3545;">⚠️ ESTORNADO POR: ${o.canceladoPor || 'Gerente'}${dataCancelado}</span>${motivoStr}`;
                corTotal = '#868e96';
                botoesAcao = `<button onclick="reimprimirCupomCliente(${o.id})" style="background:none; border:none; cursor:pointer; font-size:14px;">🖨️</button>`;
            }

            div.innerHTML = `
                <div>
                    <strong>Pedido #${o.id} ${lblEntrega} (${o.formaPagamento}) - ${statusBadge}</strong><br>
                    <small style="color:#666;">${o.itens.map(i => i.name).join(', ')}</small>
                </div>
                <div style="text-align:right;">
                    <strong style="color:${corTotal}; display:block;">R$ ${o.total.toFixed(2)}</strong>
                    ${botoesAcao}
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

// ATUALIZAÇÃO: Impressão do Cupom totalmente em NEGRITO PRETO (Para Impressoras Térmicas)
async function reimprimirCupomCliente(id) {
    try {
        const res = await fetch('http://localhost:3000/api/orders');
        const orders = await res.json();
        const o = orders.find(order => order.id === id);
        if (!o) return;

        const JANELAPRINT = window.open('', '_blank', 'width=350,height=600');
        let itensHtml = '';
        
        // Tudo envelopado em <strong> para forçar a impressora térmica a não falhar a cor
        o.itens.forEach(i => { 
            itensHtml += `
            <div style="margin-bottom:8px;">
                <strong>1x ${i.name}</strong><br>
                <strong>${i.obs}</strong><br>
                <strong>R$ ${i.price.toFixed(2)}</strong>
            </div>`; 
        });

        JANELAPRINT.document.write(`
            <html><body style="font-family:monospace;width:280px;font-size:13px;margin:10px; color:#000;">
            <center><strong>MEU CANTINHO AÇAÍ</strong><br><strong>COMPROVANTE DE PEDIDO</strong><br><strong>Pedido #${o.id} (${o.tipoPedido})</strong><br><strong>${new Date(o.data).toLocaleString('pt-BR')}</strong></center>
            <hr style="border-top:1px dashed #000;">
            ${itensHtml}
            <hr style="border-top:1px dashed #000;">
            ${o.tipoPedido === 'Entrega' ? `<strong>Taxa Entrega: R$ ${o.taxaEntrega.toFixed(2)}</strong><br>` : ''}
            <strong>FORMA PAGTO: ${o.formaPagamento}</strong><br>
            <strong>STATUS: ${(o.status || '').toUpperCase()} ${o.status === 'Cancelado' ? `por ${o.canceladoPor}` : ''}</strong><br>
            <strong>VALOR TOTAL: R$ ${o.total.toFixed(2)}</strong>
            <script>window.onload = function() { window.print(); }</script></body></html>
        `);
        JANELAPRINT.document.close();
    } catch (e) { console.error(e); }
}

async function cancelarVendaAdmin(id) {
    if (!confirm("⚠️ Tem certeza que deseja CANCELAR e estornar este pedido? Os valores contábeis serão corrigidos na hora.")) return;
    
    const motivo = prompt("📝 Digite obrigatoriamente o motivo/observação deste cancelamento:");
    if (motivo === null) return; 
    if (motivo.trim() === "") {
        alert("❌ Erro: O motivo do cancelamento não pode ficar em branco!");
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/orders/${id}`, { 
            method: 'DELETE',
            headers: {
                'X-Usuario': sessionStorage.getItem('admin_usuario'),
                'X-Motivo': motivo 
            }
        });
        if (response.ok) { alert("✅ Venda cancelada e estornada!"); carregarHistoricoVendas(); atualizarTelaCaixa(); }
    } catch (e) { console.error(e); }
}

async function carregarMovimentacoesCaixa() {
    const listaAlvo = document.getElementById('extrato-caixa');
    if (!listaAlvo) return;
    try {
        const res = await fetch('http://localhost:3000/api/caixa');
        const movs = await res.json();
        const hoje = new Date().toISOString().split('T')[0];
        const movHoje = movs.filter(m => m.data.startsWith(hoje));

        listaAlvo.innerHTML = '';
        if (movHoje.length === 0) { listaAlvo.innerHTML = '<div style="padding:15px; color:#868e96;">Nenhuma sangria ou suprimento hoje.</div>'; return; }

        movHoje.reverse().forEach(m => {
            const div = document.createElement('div');
            div.style = "padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;";
            const cor = m.tipo === 'sangria' ? '#c92a2a' : '#2b8a3e';
            
            const dataMov = m.data ? ` em ${formatarDataHora(m.data)}` : '';
            const socioStr = m.usuarioAtividade ? `<br><small style="color:#0077b6; font-weight:bold; font-size:11px;">Por: ${m.usuarioAtividade}${dataMov}</small>` : '';

            div.innerHTML = `<div><strong>${m.tipo.toUpperCase()}</strong><br><small>${m.motivo}</small>${socioStr}</div><strong style="color:${cor};">${m.tipo === 'sangria' ? '-' : '+'} R$ ${m.valor.toFixed(2)}</strong>`;
            listaAlvo.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function atualizarTelaCaixa() {
    const statusBox = document.getElementById('status-caixa-box');
    const areaAbertura = document.getElementById('area-abertura-caixa');
    const areaAberto = document.getElementById('area-caixa-aberto');
    if (!statusBox) return;

    try {
        const resOrders = await fetch('http://localhost:3000/api/orders');
        const orders = await resOrders.json();
        const resCaixa = await fetch('http://localhost:3000/api/caixa');
        const movs = await resCaixa.json();

        const hoje = new Date().toISOString().split('T')[0];
        const ordHoje = orders.filter(o => o.data.startsWith(hoje) && o.status !== 'Cancelado');
        
        const totalVendas = ordHoje.reduce((acc, cur) => acc + cur.total, 0);
        const totalSuprimentos = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'suprimento').reduce((acc, cur) => acc + cur.valor, 0);
        const totalSangrias = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'sangria').reduce((acc, cur) => acc + cur.valor, 0);

        const vendasDinheiro = ordHoje.filter(o => o.formaPagamento === 'Dinheiro').reduce((acc, cur) => acc + cur.total, 0);
        const vendasPIX = ordHoje.filter(o => o.formaPagamento === 'PIX').reduce((acc, cur) => acc + cur.total, 0);
        const vendasCartao = ordHoje.filter(o => o.formaPagamento === 'Cartão').reduce((acc, cur) => acc + cur.total, 0);
        const totalEntrega = ordHoje.reduce((acc, cur) => acc + (cur.taxaEntrega || 0), 0);

        if (caixaAberto) {
            statusBox.className = 'caixa-status-box caixa-aberto'; statusBox.innerHTML = '🟢 CAIXA ABERTO';
            areaAbertura.style.display = 'none'; areaAberto.style.display = 'block';

            let liquidoGaveta = fundoDeTroco + vendasDinheiro + totalSuprimentos - totalSangrias;
            
            document.getElementById('exibe-fundo-troco').innerText = `R$ ${fundoDeTroco.toFixed(2)}`;
            document.getElementById('exibe-vendas-dia').innerText = `R$ ${totalVendas.toFixed(2)}`;
            
            document.getElementById('exibe-vendas-dinheiro').innerText = `R$ ${vendasDinheiro.toFixed(2)}`;
            document.getElementById('exibe-vendas-pix').innerText = `R$ ${vendasPIX.toFixed(2)}`;
            document.getElementById('exibe-vendas-cartao').innerText = `R$ ${vendasCartao.toFixed(2)}`;
            document.getElementById('exibe-vendas-entrega').innerText = `R$ ${totalEntrega.toFixed(2)}`;
            
            document.getElementById('exibe-total-caixa').innerText = `R$ ${liquidoGaveta.toFixed(2)}`;
        } else {
            statusBox.className = 'caixa-status-box caixa-fechado'; statusBox.innerHTML = '🔴 CAIXA FECHADO';
            areaAbertura.style.display = 'block'; areaAberto.style.display = 'none';
        }
    } catch (e) { console.error(e); }
}

function abrirCaixa() {
    fundoDeTroco = parseFloat(document.getElementById('saldo-inicial').value) || 0;
    caixaAberto = true;
    localStorage.setItem('caixa_aberto', 'true');
    localStorage.setItem('caixa_fundo', fundoDeTroco.toString());
    atualizarTelaCaixa();
}

function fecharCaixa() {
    if (!confirm("Fechar caixa?")) return;
    caixaAberto = false; fundoDeTroco = 0;
    localStorage.setItem('caixa_aberto', 'false');
    localStorage.setItem('caixa_fundo', '0');
    atualizarTelaCaixa();
}

async function adicionarProduto() {
    const name = document.getElementById('nome-produto')?.value;
    const category = document.getElementById('categoria-produto')?.value;
    const price = parseFloat(document.getElementById('preco-produto')?.value);
    if (!name || !category || isNaN(price)) return;
    
    await fetch('http://localhost:3000/api/products', { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'X-Usuario': sessionStorage.getItem('admin_usuario')
        }, 
        body: JSON.stringify({ name, category, price }) 
    });
    
    document.getElementById('nome-produto').value = '';
    document.getElementById('preco-produto').value = '';
    carregarProdutosAdmin();
}

async function excluirProduto(id) {
    if (confirm("Excluir item?")) { await fetch(`http://localhost:3000/api/products/${id}`, { method: 'DELETE' }); carregarProdutosAdmin(); }
}

function editarProduto(id, n, p) {
    const nn = prompt("Nome:", n); const np = parseFloat(prompt("Preço:", p));
    if (!nn || isNaN(np)) return;
    
    fetch(`http://localhost:3000/api/products/${id}`, { 
        method: 'PUT', 
        headers: { 
            'Content-Type': 'application/json',
            'X-Usuario': sessionStorage.getItem('admin_usuario')
        }, 
        body: JSON.stringify({ name: nn, price: np }) 
    }).then(() => carregarProdutosAdmin());
}

// ATUALIZAÇÃO: Relatório do Caixa agora também totalmente em Negrito e Preto
async function imprimirRelatorioCaixa() {
    const resOrders = await fetch('http://localhost:3000/api/orders'); const orders = await resOrders.json();
    const resCaixa = await fetch('http://localhost:3000/api/caixa'); const movs = await resCaixa.json();
    const hoje = new Date().toISOString().split('T')[0];
    
    const ordHoje = orders.filter(o => o.data.startsWith(hoje) && o.status !== 'Cancelado');
    const totalVendas = ordHoje.reduce((acc, cur) => acc + cur.total, 0);
    const totalSuprimentos = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'suprimento').reduce((acc, cur) => acc + cur.valor, 0);
    const totalSangrias = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'sangria').reduce((acc, cur) => acc + cur.valor, 0);
    
    const vendasDinheiro = ordHoje.filter(o => o.formaPagamento === 'Dinheiro').reduce((acc, cur) => acc + cur.total, 0);
    const vendasPIX = ordHoje.filter(o => o.formaPagamento === 'PIX').reduce((acc, cur) => acc + cur.total, 0);
    const vendasCartao = ordHoje.filter(o => o.formaPagamento === 'Cartão').reduce((acc, cur) => acc + cur.total, 0);
    const totalEntrega = ordHoje.reduce((acc, cur) => acc + (cur.taxaEntrega || 0), 0);
    
    const JANELAPRINT = window.open('', '_blank', 'width=350,height=600');
    JANELAPRINT.document.write(`
        <html><body style="font-family:monospace;width:280px;font-size:13px; color:#000;">
        <center><strong>MEU CANTINHO AÇAÍ</strong><br><strong>FECHAMENTO GERENCIAL</strong><br><strong>${new Date().toLocaleString()}</strong></center><hr style="border-top:1px dashed #000;">
        <strong>Fundo Troco : R$ ${fundoDeTroco.toFixed(2)}</strong><br>
        <strong>Vendas (+)  : R$ ${totalVendas.toFixed(2)}</strong><br>
        <strong>&nbsp;&nbsp;↳ Dinheiro: R$ ${vendasDinheiro.toFixed(2)}</strong><br>
        <strong>&nbsp;&nbsp;↳ PIX: R$ ${vendasPIX.toFixed(2)}</strong><br>
        <strong>&nbsp;&nbsp;↳ Cartão: R$ ${vendasCartao.toFixed(2)}</strong><br>
        <strong>&nbsp;&nbsp;↳ Motoboy (Taxas): R$ ${totalEntrega.toFixed(2)}</strong><br>
        <strong>Suprim. (+) : R$ ${totalSuprimentos.toFixed(2)}</strong><br>
        <strong>Sangria (-) : R$ ${totalSangrias.toFixed(2)}</strong><hr style="border-top:1px dashed #000;">
        <strong>TOTAL EM GAVETA:<br>R$ ${(fundoDeTroco + vendasDinheiro + totalSuprimentos - totalSangrias).toFixed(2)}</strong><br>
        <strong>(Dinheiro Físico + Troco Inicial)</strong>
        <script>window.onload = function() { window.print(); }</script></body></html>
    `);
    JANELAPRINT.document.close();
}