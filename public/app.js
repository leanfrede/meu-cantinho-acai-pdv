// ==========================================================================
// VARIÁVEIS GLOBAIS DO SISTEMA E INICIALIZAÇÃO
// ==========================================================================
let produtosTodos = []; let carrinho = []; let categoriaAtual = 'Açaí'; let produtoSendoConfigurado = null; let totalVendaAtual = 0; let totalItensCarrinho = 0; let ultimoPedidoSalvo = null; let taxaEntregaConfigurada = 3.00; let indexSendoEditado = null; let listaClientesGlobal = [];
let caixaAberto = localStorage.getItem('caixa_aberto') === 'true'; let fundoDeTroco = parseFloat(localStorage.getItem('caixa_fundo')) || 0;
let chartInstHoras = null; let chartInstProdutos = null; let chartInstAdicionais = null;
const DICIONARIO_SOCIOS = { "1111": "Sócio A", "2222": "Sócio B" }; let pinDigitado = "";

function formatarDataHora(isoString) { if (!isoString) return ""; const d = new Date(isoString); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

document.addEventListener('keydown', (event) => {
    if (!document.getElementById('product-grid')) return;
    if (event.key === 'F2') { event.preventDefault(); finalizarVenda(); }
    if (event.key === 'Escape') { event.preventDefault(); fecharModal(); fecharModalPagamento(); fecharModalSucesso(); }
});

document.addEventListener('DOMContentLoaded', async () => {
    try { const resConfig = await fetch('/api/config'); const config = await resConfig.json(); if (config.taxaEntregaPadrao !== undefined) { taxaEntregaConfigurada = parseFloat(config.taxaEntregaPadrao); const elTaxaAdmin = document.getElementById('config-taxa-entrega'); if (elTaxaAdmin) elTaxaAdmin.value = taxaEntregaConfigurada.toFixed(2); } } catch(e) {}
    if (document.getElementById('product-grid')) { carregarProdutos(); carregarAlertaPedidosOnline(); setInterval(carregarAlertaPedidosOnline, 5000); }
    if (document.getElementById('lista-produtos')) { if (sessionStorage.getItem('admin_autenticado') === 'true') liberarPainelAdmin(); else { document.getElementById('tela-bloqueio-admin').style.display = 'flex'; document.getElementById('painel-conteudo-protegido').style.display = 'none'; } }
    if (document.getElementById('panel-cozinha')) { carregarPedidosCozinha(); setInterval(carregarPedidosCozinha, 4000); }
});

// LOGIN E ADMIN
function digitarPin(numero) { if (pinDigitado.length >= 4) return; pinDigitado += numero; document.getElementById('pin-visor').innerText = "•".repeat(pinDigitado.length); if (pinDigitado.length === 4) setTimeout(verificarPin, 200); }
function limparPin() { pinDigitado = ""; document.getElementById('pin-visor').innerText = ""; }
function verificarPin() { if (DICIONARIO_SOCIOS[pinDigitado]) { sessionStorage.setItem('admin_autenticado', 'true'); sessionStorage.setItem('admin_usuario', DICIONARIO_SOCIOS[pinDigitado]); liberarPainelAdmin(); } else { alert("❌ PIN Incorreto! Acesso negado."); limparPin(); } }
function liberarPainelAdmin() {
    document.getElementById('tela-bloqueio-admin').style.display = 'none'; document.getElementById('painel-conteudo-protegido').style.display = 'block';
    const elSocio = document.getElementById('nome-socio-logado'); if (elSocio) elSocio.innerText = sessionStorage.getItem('admin_usuario');
    carregarProdutosAdmin(); carregarHistoricoVendas(); carregarMovimentacoesCaixa(); atualizarTelaCaixa(); carregarGraficosDashboard(); if(typeof carregarCRM === 'function') carregarCRM(); 
    const hojeStr = new Date().toISOString().split('T')[0]; const elIni = document.getElementById('data-inicio-filter'); const elFim = document.getElementById('data-fim-filter');
    if (elIni && !elIni.value) elIni.value = hojeStr; if (elFim && !elFim.value) elFim.value = hojeStr;
}
function fazerLogoutAdmin() { sessionStorage.removeItem('admin_autenticado'); sessionStorage.removeItem('admin_usuario'); window.location.reload(); }
function sairParaCaixa() { window.location.href = "index.html"; }

async function salvarTaxaEntregaAdmin() {
    const novaTaxa = parseFloat(document.getElementById('config-taxa-entrega').value); if (isNaN(novaTaxa) || novaTaxa < 0) { alert("⚠️ Digite um valor válido!"); return; }
    try { const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxaEntregaPadrao: novaTaxa }) }); if (res.ok) { taxaEntregaConfigurada = novaTaxa; alert(`✅ Sucesso! Taxa alterada para R$ ${novaTaxa.toFixed(2)}.`); } } catch(e) {}
}

// ALERTA ONLINE E APROVAÇÃO
async function carregarAlertaPedidosOnline() {
    const barra = document.getElementById('alerta-pedidos-online'); const botoes = document.getElementById('lista-botoes-online'); const txt = document.getElementById('txt-alerta-online'); if (!barra) return;
    try {
        const res = await fetch('/api/orders'); const orders = await res.json(); const pendentesOnline = orders.filter(o => o.origem === 'Online' && o.status === 'Aguardando');
        if (pendentesOnline.length === 0) { barra.style.display = 'none'; return; }
        barra.style.display = 'flex'; txt.innerText = `🔔 ${pendentesOnline.length} novo(s) pedido(s) vindo do Cardápio Digital!`; botoes.innerHTML = '';
        pendentesOnline.forEach(o => {
            const btn = document.createElement('button'); btn.style = "background: #2b9348; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);";
            btn.innerText = `✔ Aprovar #${o.id} (${o.nomeClienteOnline || 'Cliente'}) - R$ ${o.total.toFixed(2)}`; btn.onclick = () => aprovarPedidoOnline(o); botoes.appendChild(btn);
        });
    } catch(e) {}
}
async function aprovarPedidoOnline(pedido) {
    if (!confirm(`🚨 APROVAR PEDIDO ONLINE #${pedido.id}\n-----------------------------------------\n👤 Cliente: ${pedido.nomeClienteOnline || 'Web'}\n🛵 Tipo: ${pedido.tipoPedido}\n💰 Total: R$ ${pedido.total.toFixed(2)}\n-----------------------------------------\nDeseja confirmar a entrada deste pedido no caixa?`)) return;
    try { const res = await fetch(`/api/orders/${pedido.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Pendente' }) }); if (res.ok) { alert(`✅ Pedido #${pedido.id} aprovado com sucesso!`); carregarAlertaPedidosOnline(); atualizarTelaCaixa(); carregarPedidosCozinha(); if(typeof carregarCRM === 'function') carregarCRM(); } } catch(e) {}
}

// CAIXA FÍSICO
async function carregarProdutos() { try { const response = await fetch('/api/products'); produtosTodos = await response.json(); renderizarProdutos(); } catch (error) {} }
function renderizarProdutos() {
    const grid = document.getElementById('product-grid'); if (!grid) return; grid.innerHTML = '';
    const produtosFiltrados = produtosTodos.filter(p => {
        const catBanco = (p.category || '').toLowerCase().trim(); const catAba = categoriaAtual.toLowerCase().trim();
        if (catAba === 'açaí' || catAba === 'açaís') return catBanco === 'açaí' || catBanco === 'açaís' || catBanco === 'acai' || catBanco === 'acais';
        if (catAba === 'cremes' || catAba === 'creme') return catBanco === 'cremes' || catBanco === 'creme';
        return catBanco === catAba;
    });
    produtosFiltrados.sort((a, b) => a.name.localeCompare(b.name));
    if (produtosFiltrados.length === 0) { grid.innerHTML = `<p style="grid-column: 1/-1; color: #868e96; text-align: center; margin-top: 20px;">Nenhum produto em <strong>${categoriaAtual}</strong>.</p>`; return; }
    produtosFiltrados.forEach(p => {
        const btn = document.createElement('button'); btn.className = 'produto-btn'; const estoqueAtual = p.estoque !== undefined ? p.estoque : 50; const disponivel = p.available !== false && estoqueAtual > 0;
        if (!disponivel) {
            btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; btn.style.border = '2px dashed #dc3545';
            btn.innerHTML = `<span>${p.name}<br><small style="color:#dc3545; font-weight:bold; font-size:11px;">⚠️ ESGOTADO</small></span><span class="price-tag" style="background:#6c757d; color:white;">R$ ${p.price.toFixed(2)}</span>`; btn.onclick = () => alert(`⚠️ Desculpe! O item "${p.name}" acabou no estoque.`);
        } else {
            let alertaEstoque = `<small style="color:#868e96; font-size:11px; display:block; margin-top:3px;">📦 Estoque: ${estoqueAtual} un.</small>`;
            if (estoqueAtual <= 5) alertaEstoque = `<small style="color:#d62828; font-weight:bold; font-size:11px; display:block; margin-top:3px; background:#ffe5d9; padding:2px 4px; border-radius:4px;">⚠️ ÚLTIMAS ${estoqueAtual} UN.</small>`;
            btn.innerHTML = `<span>${p.name} ${alertaEstoque}</span><span class="price-tag">R$ ${p.price.toFixed(2)}</span>`; btn.onclick = () => abrirModal(p);
        }
        grid.appendChild(btn);
    });
}
function filtrarCategoria(categoria) { categoriaAtual = categoria; document.querySelectorAll('.tab-btn').forEach(btn => { if (btn.innerText.toLowerCase().includes(categoria.toLowerCase())) btn.classList.add('active'); else btn.classList.remove('active'); }); renderizarProdutos(); }

function abrirSecoesCaixaPorCategoria(categoria) {
    const cat = (categoria || '').toLowerCase().trim();
    const secCremes = document.getElementById('caixa-secao-cremes'); const secCob = document.getElementById('caixa-secao-coberturas');
    const secAcomp = document.getElementById('caixa-secao-acomp'); const secTap = document.getElementById('caixa-secao-tapioca'); const secBeb = document.getElementById('caixa-secao-bebida');
    if(secCremes) secCremes.style.display = 'none'; if(secCob) secCob.style.display = 'none'; if(secAcomp) secAcomp.style.display = 'none'; if(secTap) secTap.style.display = 'none'; if(secBeb) secBeb.style.display = 'none';
    if (cat.includes('açaí') || cat.includes('acai') || cat.includes('creme') || cat === '') { if(secCremes) secCremes.style.display = 'block'; if(secCob) secCob.style.display = 'block'; if(secAcomp) secAcomp.style.display = 'block'; }
    else if (cat.includes('tapioca') || cat.includes('crepe') || cat.includes('crepioca')) { if(secTap) secTap.style.display = 'block'; }
    else if (cat.includes('bebida') || cat.includes('suco') || cat.includes('água')) { if(secBeb) secBeb.style.display = 'block'; }
}

function abrirModal(produto) {
    indexSendoEditado = null; produtoSendoConfigurado = produto;
    const modalTitulo = document.getElementById('modal-titulo'); if (modalTitulo) modalTitulo.innerText = `Personalizar: ${produto.name}`;
    abrirSecoesCaixaPorCategoria(produto.category);
    document.querySelectorAll('#modal-conteudo input[type="checkbox"]').forEach(cb => cb.checked = false);
    const elObs = document.getElementById('caixa-modal-obs'); if (elObs) elObs.value = '';
    const btnConf = document.querySelector('#modal-produto .btn-primary'); if(btnConf) btnConf.innerText = "Confirmar Receita";
    const modalDiv = document.getElementById('modal-produto'); if (modalDiv) modalDiv.style.display = 'flex';
}
function fecharModal() { indexSendoEditado = null; const modalDiv = document.getElementById('modal-produto'); if (modalDiv) modalDiv.style.display = 'none'; }
function editarDoCarrinho(index) {
    indexSendoEditado = index; const item = carrinho[index]; produtoSendoConfigurado = produtosTodos.find(p => p.id === item.id) || { id: item.id, name: item.name, price: item.price, category: item.category };
    const modalTitulo = document.getElementById('modal-titulo'); if (modalTitulo) modalTitulo.innerText = `Editar: ${item.name}`;
    abrirSecoesCaixaPorCategoria(produtoSendoConfigurado.category || 'Açaí');
    document.querySelectorAll('#modal-conteudo input[type="checkbox"]').forEach(cb => cb.checked = false);
    if(item.cremes) item.cremes.forEach(v => { const el = document.querySelector(`input[name="creme"][value="${v}"]`); if(el) el.checked = true; });
    if(item.coberturas) item.coberturas.forEach(v => { const el = document.querySelector(`input[name="cobertura"][value="${v}"]`); if(el) el.checked = true; });
    if(item.acompanhamentos) item.acompanhamentos.forEach(v => { const el = document.querySelector(`input[name="acompanhamento"][value="${v}"]`); if(el) el.checked = true; });
    if(item.tapiocaOpt) item.tapiocaOpt.forEach(v => { const el = document.querySelector(`input[name="tapioca-opt"][value="${v}"]`); if(el) el.checked = true; });
    if(item.bebidaOpt) item.bebidaOpt.forEach(v => { const el = document.querySelector(`input[name="bebida-opt"][value="${v}"]`); if(el) el.checked = true; });
    const elObs = document.getElementById('caixa-modal-obs'); if (elObs) elObs.value = item.obsLivre || '';
    const btnConf = document.querySelector('#modal-produto .btn-primary'); if(btnConf) btnConf.innerText = "✔ Salvar Alterações";
    const modalDiv = document.getElementById('modal-produto'); if (modalDiv) modalDiv.style.display = 'flex';
}
function confirmarAdicao() {
    const cat = (produtoSendoConfigurado.category || '').toLowerCase().trim();
    let observacao = ""; let cremes = [], coberturas = [], acompanhamentos = [], tapOpt = [], bebOpt = [];
    if (cat.includes('açaí') || cat.includes('acai') || cat.includes('creme') || cat === '') {
        cremes = Array.from(document.querySelectorAll('input[name="creme"]:checked')).map(cb => cb.value); coberturas = Array.from(document.querySelectorAll('input[name="cobertura"]:checked')).map(cb => cb.value); acompanhamentos = Array.from(document.querySelectorAll('input[name="acompanhamento"]:checked')).map(cb => cb.value);
        if (cremes.length > 2) { alert("⚠️ Escolha no máximo 2 Cremes."); return; } if (coberturas.length > 2) { alert("⚠️ Escolha no máximo 2 Coberturas."); return; } if (acompanhamentos.length > 5) { alert("⚠️ Escolha no máximo 5 Acompanhamentos."); return; }
        if (cremes.length > 0) observacao += `Cremes: ${cremes.join(', ')}`; if (coberturas.length > 0) observacao += (observacao ? ' | ' : '') + `Cob: ${coberturas.join(', ')}`; if (acompanhamentos.length > 0) observacao += (observacao ? ' | ' : '') + `Acomps: ${acompanhamentos.join(', ')}`;
    } else if (cat.includes('tapioca') || cat.includes('crepe') || cat.includes('crepioca')) {
        tapOpt = Array.from(document.querySelectorAll('input[name="tapioca-opt"]:checked')).map(cb => cb.value); if (tapOpt.length > 0) observacao += `Preparo: ${tapOpt.join(', ')}`;
    } else if (cat.includes('bebida') || cat.includes('suco') || cat.includes('água')) {
        bebOpt = Array.from(document.querySelectorAll('input[name="bebida-opt"]:checked')).map(cb => cb.value); if (bebOpt.length > 0) observacao += `Preferência: ${bebOpt.join(', ')}`;
    }
    const obsTexto = document.getElementById('caixa-modal-obs') ? document.getElementById('caixa-modal-obs').value.trim() : '';
    if (obsTexto) observacao += (observacao ? ' | ' : '') + `Obs: ${obsTexto}`;
    if (!observacao) observacao = cat.includes('tapioca') || cat.includes('crepioca') ? "Tradicional simples" : (cat.includes('bebida') ? "Bebida padrão" : "Tradicional simples");

    const novoItem = { id: produtoSendoConfigurado.id, name: produtoSendoConfigurado.name, price: produtoSendoConfigurado.price, category: produtoSendoConfigurado.category, obs: observacao, cremes, coberturas, acompanhamentos, tapiocaOpt: tapOpt, bebidaOpt: bebOpt, obsLivre: obsTexto };
    if (indexSendoEditado !== null) { carrinho[indexSendoEditado] = novoItem; indexSendoEditado = null; } else { carrinho.push(novoItem); }
    atualizarCarrinhoUI(); fecharModal();
}
function atualizarCarrinhoUI() {
    const lista = document.getElementById('cart-items'); const elTotal = document.getElementById('total-price'); const elContagem = document.getElementById('itens-contagem');
    if (!lista) return; lista.innerHTML = ''; let subtotal = 0;
    carrinho.forEach((item, index) => {
        subtotal += item.price; const div = document.createElement('div'); div.className = 'cart-item-row';
        div.innerHTML = `<div class="cart-item-info"><strong>1x ${item.name}</strong><small>${item.obs}</small></div><div class="cart-item-right"><span>R$ ${item.price.toFixed(2)}</span><button class="btn-editar-item" onclick="editarDoCarrinho(${index})" title="Editar Item" style="background:none; border:none; cursor:pointer; font-size:14px; margin-right:4px;">✏️</button><button class="btn-remover-item" onclick="removerDoCarrinho(${index})" title="Remover Item">❌</button></div>`;
        lista.appendChild(div);
    });
    if (elTotal) elTotal.innerText = `R$ ${subtotal.toFixed(2)}`; if (elContagem) elContagem.innerText = `${carrinho.length} ${carrinho.length === 1 ? 'item' : 'itens'}`;
}
function removerDoCarrinho(index) { carrinho.splice(index, 1); atualizarCarrinhoUI(); }

// FECHAMENTO
function finalizarVenda() {
    if (carrinho.length === 0) { alert('⚠️ O carrinho está vazio!'); return; }
    const valorTotalStr = document.getElementById('total-price').innerText.replace('R$', '').trim(); totalItensCarrinho = parseFloat(valorTotalStr); totalVendaAtual = totalItensCarrinho;
    document.getElementById('pedido-tipo').value = 'Balcão'; document.getElementById('taxa-entrega').value = '';
    const elNomeCli = document.getElementById('caixa-nome-cliente'); if(elNomeCli) elNomeCli.value = ''; const elEndCli = document.getElementById('caixa-endereco-entrega'); if(elEndCli) elEndCli.value = '';
    document.getElementById('div-dados-entrega').style.display = 'none'; document.getElementById('modal-pagamento-total').innerText = `R$ ${totalVendaAtual.toFixed(2)}`;
    document.getElementById('pagamento-metodo').value = 'Dinheiro'; document.getElementById('pagamento-recebido').value = ''; document.getElementById('pagamento-troco').innerText = 'R$ 0.00';
    document.getElementById('div-calculo-troco').style.display = 'block'; document.getElementById('telefone-fidelidade').value = ''; document.getElementById('status-fidelidade').innerText = 'Digite o número para checar os pontos...'; document.getElementById('status-fidelidade').style.color = '#4a0072';
    document.getElementById('modal-pagamento').style.display = 'flex';
}
function fecharModalPagamento() { document.getElementById('modal-pagamento').style.display = 'none'; }
function alternarTipoPedido() {
    const tipo = document.getElementById('pedido-tipo').value; const divDadosEntrega = document.getElementById('div-dados-entrega');
    if (tipo === 'Entrega') { divDadosEntrega.style.display = 'block'; document.getElementById('taxa-entrega').value = taxaEntregaConfigurada.toFixed(2); } 
    else { divDadosEntrega.style.display = 'none'; document.getElementById('taxa-entrega').value = ''; const elNomeCli = document.getElementById('caixa-nome-cliente'); if(elNomeCli) elNomeCli.value = ''; const elEndCli = document.getElementById('caixa-endereco-entrega'); if(elEndCli) elEndCli.value = ''; }
    calcularTotalComEntrega();
}
function calcularTotalComEntrega() { const taxa = parseFloat(document.getElementById('taxa-entrega').value) || 0; totalVendaAtual = totalItensCarrinho + taxa; document.getElementById('modal-pagamento-total').innerText = `R$ ${totalVendaAtual.toFixed(2)}`; calcularTroco(); }
function alternarCampoTroco() { const metodo = document.getElementById('pagamento-metodo').value; const divTroco = document.getElementById('div-calculo-troco'); if (metodo === 'Dinheiro') divTroco.style.display = 'block'; else divTroco.style.display = 'none'; }
function calcularTroco() { const recebido = parseFloat(document.getElementById('pagamento-recebido').value) || 0; const troco = recebido - totalVendaAtual; const elTroco = document.getElementById('pagamento-troco'); if (troco < 0) { elTroco.innerText = "Valor insuficiente"; elTroco.style.color = "#c92a2a"; } else { elTroco.innerText = `R$ ${troco.toFixed(2)}`; elTroco.style.color = "#2b8a3e"; } }

async function verificarFidelidade() {
    const tel = document.getElementById('telefone-fidelidade').value.replace(/\D/g, ''); if(tel.length < 10) { alert("⚠️ Digite um telefone válido com DDD."); return; }
    try {
        const res = await fetch(`/api/clientes/${tel}`); const data = await res.json(); const numPedidos = data.pedidos || 0; const divStatus = document.getElementById('status-fidelidade');
        let txtExtra = ""; if (data.dados && data.dados.nome && data.dados.nome !== "Cliente Balcão") txtExtra = ` | 👤 <b>${data.dados.nome}</b>`;
        if(data.dados) {
            const elNomeCli = document.getElementById('caixa-nome-cliente'); const elEndCli = document.getElementById('caixa-endereco-entrega');
            if (elNomeCli && !elNomeCli.value && data.dados.nome !== "Cliente Balcão") elNomeCli.value = data.dados.nome;
            if (elEndCli && !elEndCli.value && data.dados.endereco && data.dados.endereco !== "Não cadastrado") elEndCli.value = data.dados.endereco;
        }
        if(numPedidos >= 9) { divStatus.innerHTML = `🎉 UAU! 10º pedido! O cliente GANHOU o prêmio!${txtExtra}`; divStatus.style.color = '#d62828'; } else { divStatus.innerHTML = `🌟 O cliente já tem ${numPedidos} pedido(s) salvo(s).${txtExtra}`; divStatus.style.color = '#2b9348'; }
    } catch(e) {}
}

async function confirmarVendaComPagamento() {
    const metodo = document.getElementById('pagamento-metodo').value; const recebido = parseFloat(document.getElementById('pagamento-recebido').value) || 0;
    let tipoPed = document.getElementById('pedido-tipo').value; const taxaPed = parseFloat(document.getElementById('taxa-entrega').value) || 0; let nomeClienteCaixa = null;
    if (tipoPed === 'Entrega') {
        const enderecoDigitado = document.getElementById('caixa-endereco-entrega').value.trim(); nomeClienteCaixa = document.getElementById('caixa-nome-cliente').value.trim() || 'Cliente Delivery';
        if (!enderecoDigitado) { alert("⚠️ Para Entregas, é obrigatório digitar o Endereço de Entrega!"); return; } tipoPed = `Entrega (Endereço: ${enderecoDigitado})`;
    } else { const nomeOpcional = document.getElementById('caixa-nome-cliente'); if (nomeOpcional && nomeOpcional.value.trim()) nomeClienteCaixa = nomeOpcional.value.trim(); }
    const telefoneFidelidadeRaw = document.getElementById('telefone-fidelidade').value.replace(/\D/g, ''); const telefoneFidelidadeFinal = telefoneFidelidadeRaw.length >= 10 ? telefoneFidelidadeRaw : null;
    if (metodo === 'Dinheiro' && recebido < totalVendaAtual) { alert("⚠️ O valor entregue é insuficiente!"); return; }
    const troco = metodo === 'Dinheiro' ? (recebido - totalVendaAtual) : 0;
    const dadosVenda = { itens: carrinho, total: totalVendaAtual, formaPagamento: metodo, valorRecebido: metodo === 'Dinheiro' ? recebido : totalVendaAtual, troco: troco, tipoPedido: tipoPed, taxaEntrega: taxaPed, clienteFidelidade: telefoneFidelidadeFinal, nomeClienteOnline: nomeClienteCaixa, origem: 'Balcão', data: new Date().toISOString() };
    try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosVenda) });
        if (response.ok) {
            ultimoPedidoSalvo = await response.json(); carrinho = []; atualizarCarrinhoUI(); fecharModalPagamento();
            document.getElementById('whatsapp-cliente').value = telefoneFidelidadeFinal ? telefoneFidelidadeFinal : '';
            document.getElementById('modal-sucesso').style.display = 'flex'; carregarProdutos(); if(typeof carregarCRM === 'function') carregarCRM(); 
        }
    } catch (error) {}
}
function fecharModalSucesso() { document.getElementById('modal-sucesso').style.display = 'none'; ultimoPedidoSalvo = null; }
function imprimirUltimoPedido() { if(ultimoPedidoSalvo && ultimoPedidoSalvo.id) reimprimirCupomCliente(ultimoPedidoSalvo.id); else alert("Nenhum pedido recente salvo para imprimir."); }

function enviarCupomWhatsApp() {
    if (!ultimoPedidoSalvo) return;
    let fone = document.getElementById('whatsapp-cliente').value.replace(/\D/g, ''); if (!fone || fone.length < 10) { alert("⚠️ Digite um número válido com DDD!"); return; } if (fone.length === 10 || fone.length === 11) fone = '55' + fone;
    let msg = `*🔮 MEU CANTINHO AÇAÍ* \n-----------------------------\n*COMPROVANTE DE COMPRA*\n*Pedido:* #${ultimoPedidoSalvo.id} (${ultimoPedidoSalvo.tipoPedido})\n*Data:* ${new Date(ultimoPedidoSalvo.data).toLocaleString('pt-BR')}\n-----------------------------\n`;
    ultimoPedidoSalvo.itens.forEach(i => { msg += `• *1x ${i.name}*\n  _${i.obs}_\n  R$ ${i.price.toFixed(2)}\n\n`; }); msg += `-----------------------------\n`;
    if (ultimoPedidoSalvo.tipoPedido.includes('Entrega')) msg += `*Taxa de Entrega:* R$ ${ultimoPedidoSalvo.taxaEntrega.toFixed(2)}\n`;
    msg += `*Forma de Pagto:* ${ultimoPedidoSalvo.formaPagamento}\n`;
    if (ultimoPedidoSalvo.formaPagamento.includes('Dinheiro')) msg += `*Valor Entregue:* R$ ${ultimoPedidoSalvo.valorRecebido.toFixed(2)}\n*Troco Devolvido:* R$ ${ultimoPedidoSalvo.troco.toFixed(2)}\n`;
    msg += `*VALOR TOTAL: R$ ${ultimoPedidoSalvo.total.toFixed(2)}*\n-----------------------------\n`;
    if (ultimoPedidoSalvo.pontosAtuais) msg += `🎁 *CLUBE FIDELIDADE:*\nVocê tem *${ultimoPedidoSalvo.pontosAtuais}* pedido(s).\nComplete 10 e ganhe um Açaí 300ml!\n-----------------------------\n`;
    msg += `_Obrigado pela preferência! Volte sempre!_ ✨🍧`;
    window.open(`https://api.whatsapp.com/send?phone=${fone}&text=${encodeURIComponent(msg)}`, '_blank');
}

async function registrarMovimentacao(tipo) {
    const valorInput = prompt(`💰 Digite o valor para a ${tipo.toUpperCase()}:`); if (!valorInput) return;
    const valor = parseFloat(valorInput.replace(',', '.')); const motivo = prompt(`📝 Qual o motivo?`); if (!motivo) return;
    const socioResponsavel = sessionStorage.getItem('admin_usuario') || 'Balcão';
    try { await fetch('/api/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': socioResponsavel }, body: JSON.stringify({ tipo, valor, motivo, data: new Date().toISOString() }) }); alert(`✅ Registrado com sucesso!`); } catch (error) { console.error(error); }
}

async function carregarPedidosCozinha() {
    const painel = document.getElementById('panel-cozinha'); const contador = document.getElementById('cozinha-contador'); if (!painel) return;
    try {
        const response = await fetch('/api/orders'); const pedidos = await response.json(); const hoje = new Date().toISOString().split('T')[0];
        const filaPendente = pedidos.filter(o => o.data.startsWith(hoje) && o.status === 'Pendente');
        if (contador) contador.innerText = `${filaPendente.length} ${filaPendente.length === 1 ? 'Pedido na Fila' : 'Pedidos na Fila'}`;
        painel.innerHTML = '';
        if (filaPendente.length === 0) { painel.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#868e96; font-size:18px;">✨ Nossos clientes já estão de barriga cheia!<br>Nenhum pedido na fila de montagem.</div>`; return; }
        filaPendente.forEach(p => {
            const card = document.createElement('div'); card.className = 'card-pedido-cozinha';
            const badgeClass = p.tipoPedido.includes('Entrega') ? 'pedido-badge-entrega' : 'pedido-badge-balcao'; const badgeTexto = p.tipoPedido.includes('Entrega') ? '🛵 ENTREGA' : '🏪 BALCÃO';
            let itensHtml = ''; p.itens.forEach(i => { itensHtml += `<div class="item-linha-cozinha"><strong>📦 1x ${i.name}</strong><p>📋 ${i.obs}</p></div>`; });
            const horaPedido = new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            card.innerHTML = `<div><div class="pedido-topo"><span style="font-weight:bold; font-size:16px;">Comanda #${p.id} ${p.origem === 'Online' ? '🌐 ONLINE' : ''}</span><span class="${badgeClass}">${badgeTexto}</span></div><div style="font-size:13px; color:#868e96; margin-bottom:12px;">⏰ Recebido às: ${horaPedido} ${p.nomeClienteOnline ? `| Cliente: <b>${p.nomeClienteOnline}</b>` : ''}</div><div style="background:#fff3cd; color:#856404; padding:6px 8px; border-radius:6px; font-size:13px; margin-bottom:10px; font-weight:bold;">💰 Pagamento: ${p.formaPagamento}</div><div class="pedido-corpo-itens">${itensHtml}</div></div><button class="btn-pronto" onclick="concluirPreparoCozinha(${p.id})">✔ CONCLUÍDO / PRONTO</button>`;
            painel.appendChild(card);
        });
    } catch (error) {}
}
async function concluirPreparoCozinha(id) { try { const response = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Pronto' }) }); if (response.ok) carregarPedidosCozinha(); } catch (e) {} }

async function carregarGraficosDashboard() { /* Omitido */ }
async function carregarProdutosAdmin() {
    const lista = document.getElementById('lista-produtos'); if (!lista) return;
    try {
        const response = await fetch('/api/products'); const produtos = await response.json(); lista.innerHTML = '';
        produtos.sort((a, b) => a.name.localeCompare(b.name));
        const categoriasPresentes = [...new Set(produtos.map(p => p.category))].sort();
        if (produtos.length === 0) { lista.innerHTML = '<div style="padding:15px; color:#f8f9fa;">Nenhum produto cadastrado.</div>'; return; }
        categoriasPresentes.forEach(categoria => {
            const catHeader = document.createElement('div'); catHeader.style = "background: var(--cor-marca); color: white; padding: 10px 15px; border-radius: 6px; font-weight: 800; margin-top: 15px; margin-bottom: 5px; font-size: 15px; text-transform: uppercase;"; catHeader.innerText = `📂 ${categoria || 'Sem Categoria'}`; lista.appendChild(catHeader);
            const produtosDaCategoria = produtos.filter(p => p.category === categoria);
            produtosDaCategoria.forEach(p => {
                const estoqueAtual = p.estoque !== undefined ? p.estoque : 50; const disponivel = p.available !== false && estoqueAtual > 0;
                const statusTexto = disponivel ? '🟢 Ativo' : '🔴 Esgotado'; const statusCor = disponivel ? '#2b9348' : '#dc3545';
                const dataStr = p.dataAtividade ? ` em ${formatarDataHora(p.dataAtividade)}` : ''; const responsavelStr = p.usuarioAtividade ? `(Por: ${p.usuarioAtividade}${dataStr})` : '';
                let corEstoque = '#4cc9f0'; if (estoqueAtual <= 5) corEstoque = '#ff4d6d';
                const div = document.createElement('div');
                div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-left: 20px;"><div><strong style="color:#f8f9fa; font-size:15px;">${p.name}</strong><div style="font-size:12px; color:#aaa;">R$ ${p.price.toFixed(2)} | <strong style="color:${corEstoque};">Estoque: ${estoqueAtual} un.</strong><br><span style="color:#4cc9f0; font-weight:bold; font-size:11px;">${responsavelStr}</span></div></div><div style="display:flex; gap:6px; align-items:center;"><button onclick="reporEstoque(${p.id}, '${p.name}')" style="background:#4361ee; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">📦 Repor</button><button onclick="alternarStatusProduto(${p.id}, ${disponivel})" style="background:${statusCor}; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">${statusTexto}</button><button onclick="editarProduto(${p.id}, '${p.name}', ${p.price})" style="background:#ffc107; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; color:#000;">✏️</button><button onclick="excluirProduto(${p.id})" style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button></div></div>`;
                lista.appendChild(div);
            });
        });
    } catch (e) {}
}
async function reporEstoque(id, nomeProduto) { const qtdStr = prompt(`📦 Reposição para: "${nomeProduto}"\n\nQuantas unidades extras?`); if (!qtdStr) return; const qtd = parseInt(qtdStr); if (isNaN(qtd) || qtd <= 0) return; try { const response = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, body: JSON.stringify({ adicionarEstoque: qtd }) }); if (response.ok) { alert(`✅ Sucesso!`); carregarProdutosAdmin(); } } catch (error) {} }
async function alternarStatusProduto(id, statusAtual) { try { const response = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, body: JSON.stringify({ available: !statusAtual }) }); if (response.ok) carregarProdutosAdmin(); } catch (error) {} }
async function adicionarProduto() { const name = document.getElementById('nome-produto')?.value; const category = document.getElementById('categoria-produto')?.value; const price = parseFloat(document.getElementById('preco-produto')?.value); const estoque = parseInt(document.getElementById('estoque-produto')?.value) || 50; if (!name || !category || isNaN(price)) return; await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, body: JSON.stringify({ name, category, price, estoque }) }); document.getElementById('nome-produto').value = ''; document.getElementById('preco-produto').value = ''; document.getElementById('estoque-produto').value = '50'; carregarProdutosAdmin(); }
async function excluirProduto(id) { if (confirm("Excluir item?")) { await fetch(`/api/products/${id}`, { method: 'DELETE' }); carregarProdutosAdmin(); } }
function editarProduto(id, n, p) { const nn = prompt("Nome:", n); const np = parseFloat(prompt("Preço:", p)); if (!nn || isNaN(np)) return; fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, body: JSON.stringify({ name: nn, price: np }) }).then(() => carregarProdutosAdmin()); }
async function carregarHistoricoVendas() { /* Omitido */ }
async function cancelarVendaAdmin(id) { /* Omitido */ }
async function carregarMovimentacoesCaixa() { /* Omitido */ }
async function atualizarTelaCaixa() { /* Omitido */ }
function abrirCaixa() { /* Omitido */ }
function fecharCaixa() { /* Omitido */ }
async function carregarCRM() { /* Omitido */ }
function filtrarCRM(tipo, elemBotao) { /* Omitido */ }
function renderizarCRM(tipo) { /* Omitido */ }
function abrirWhatsAppResgate(telefone, nome, dias) { /* Omitido */ }
async function gerarRelatorioPeriodo() { /* Omitido */ }

// ==========================================================================
// 🔥 IMPRESSÃO DUPLA COM QR CODE PIX (INTELIGENTE) 🔥
// ==========================================================================
async function reimprimirCupomCliente(id) {
    try {
        const res = await fetch('/api/orders'); const orders = await res.json();
        const o = orders.find(order => order.id === id); if (!o) return;
        let itensHtml = ''; let subtotal = 0;
        o.itens.forEach(i => {
            subtotal += i.price; let obsFormatada = i.obs.replace(/ \| /g, '<br>• '); if(obsFormatada) obsFormatada = "• " + obsFormatada;
            itensHtml += `<div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 15px; margin-top: 12px; color: #000;"><span>1x ${i.name}</span><span>R$ ${i.price.toFixed(2)}</span></div><div style="font-size: 13px; color: #000; margin-left: 5px; margin-bottom: 10px; line-height: 1.4; font-weight: 600;">${obsFormatada}</div>`;
        });

        let clienteHtml = '';
        if (o.nomeClienteOnline || o.clienteFidelidade || o.tipoPedido.includes('Entrega')) {
            clienteHtml = `<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px dashed #000; font-size: 14px; line-height: 1.5; color: #000; font-weight: bold;">`;
            if (o.nomeClienteOnline) clienteHtml += `👤 Cliente: ${o.nomeClienteOnline}<br>`;
            if (o.clienteFidelidade) clienteHtml += `📱 WhatsApp: ${o.clienteFidelidade}<br>`;
            if (o.tipoPedido.includes('Entrega')) { let end = o.tipoPedido.split('Endereço: ')[1]; if (end) end = end.replace(')', ''); clienteHtml += `🛵 Endereço: ${end || 'Não informado'}<br>`; }
            clienteHtml += `</div>`;
        }

        let taxaHtml = ''; if (o.taxaEntrega > 0) taxaHtml = `<div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; font-weight: bold; color: #000;"><span>Taxa de Entrega:</span><span>R$ ${o.taxaEntrega.toFixed(2)}</span></div>`;
        let trocoHtml = ''; if (o.formaPagamento.includes('Dinheiro') && o.troco > 0) {
            trocoHtml = `<div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 4px; font-weight: bold; color: #000;"><span>Valor Recebido:</span><span>R$ ${o.valorRecebido.toFixed(2)}</span></div><div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-top: 4px; color: #000;"><span>Troco:</span><span>R$ ${o.troco.toFixed(2)}</span></div>`;
        }
        let statusTexto = (o.status || '').toUpperCase(); if (o.status === 'Cancelado') statusTexto += ` (Por ${o.canceladoPor})`;

        // FUNÇÃO QUE GERA A VIA INTELIGENTE (COM QR CODE SOMENTE PARA CLIENTE E EM DINHEIRO)
        const gerarVia = (nomeDaVia) => {
            let pixHtml = '';
            
            // SE FOR A VIA DO CLIENTE **E** A FORMA DE PAGAMENTO FOR DINHEIRO...
            if (nomeDaVia === "VIA DO CLIENTE" && o.formaPagamento.includes('Dinheiro')) {
                pixHtml = `
                    <div style="text-align: center; margin-top: 15px; border-top: 2px dashed #000; padding-top: 15px; page-break-inside: avoid;">
                        <strong style="font-size: 16px; color: #000;">PAGUE COM PIX ⚡</strong><br>
                        <small style="font-size: 13px; font-weight: bold; color: #000;">Mudou de ideia? Pague no PIX agora:</small><br>
                        <!-- LEANDRO: Salve a imagem do seu QR Code PIX do banco como "pix.png" e coloque na pasta "public" do seu sistema -->
                        <img src="pix.png" style="width: 120px; height: 120px; margin: 10px 0;" alt="[QR Code do PIX aqui]" onerror="this.style.display='none'" /><br>
                        <strong style="font-size: 14px; color: #000;">Chave PIX: (Seu Celular/CNPJ)</strong><br>
                        <small style="font-size: 12px; color: #000;">Meu Cantinho Açaí</small>
                    </div>
                `;
            }

            return `
                <div class="header">
                    <h1 class="logo-txt">Meu Cantinho Açaí</h1>
                    <div class="via-badge">${nomeDaVia}</div>
                    <p class="sub-header">Data: ${new Date(o.data).toLocaleString('pt-BR')}</p>
                </div>
                <div class="order-badge">
                    <h2>#${o.id}</h2>
                    <p>${o.tipoPedido.split(' ')[0]}</p>
                </div>
                ${clienteHtml}
                <div class="info-section">
                    STATUS: ${statusTexto}<br>
                    PAGAMENTO: ${o.formaPagamento}
                </div>
                <div class="items">
                    <strong style="font-size: 16px; border-bottom: 2px solid #000; display: block; margin-bottom: 8px; color: #000;">Itens do Pedido</strong>
                    ${itensHtml}
                </div>
                <div class="totals">
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; font-weight: bold; color: #000;">
                        <span>Subtotal:</span><span>R$ ${subtotal.toFixed(2)}</span>
                    </div>
                    ${taxaHtml}
                    ${trocoHtml}
                    <div class="grand-total">
                        <span>TOTAL:</span><span>R$ ${o.total.toFixed(2)}</span>
                    </div>
                </div>
                ${pixHtml}
                <div class="footer">
                    Obrigado pela preferência!<br>VOLTE SEMPRE!<br>
                </div>
            `;
        };

        const JANELAPRINT = window.open('', '_blank', 'width=400,height=600');
        const html = `<html><head><style>@media print { @page { margin: 0; } body { margin: 0; padding: 10px; } * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; color: #000 !important; font-weight: bold !important; } } body { font-family: 'Arial', sans-serif; width: 300px; margin: 0 auto; color: #000; padding: 10px; box-sizing: border-box; } .header { text-align: center; margin-bottom: 10px; } .logo-txt { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: -0.5px; color: #000; } .via-badge { border: 2px solid #000; display: inline-block; padding: 4px 10px; font-size: 14px; font-weight: 900; margin: 8px 0; border-radius: 4px; color: #000; } .sub-header { font-size: 13px; color: #000; margin: 0; font-weight: 600; } .order-badge { border: 4px solid #000; background: #fff; text-align: center; padding: 10px; margin: 15px 0; border-radius: 6px; } .order-badge h2 { margin: 0; font-size: 38px; font-weight: 900; color: #000; } .order-badge p { margin: 0; font-size: 16px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; color: #000; } .info-section { margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; font-size: 14px; line-height: 1.5; font-weight: 900; color: #000; } .items { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; } .totals { padding-top: 5px; } .grand-total { display: flex; justify-content: space-between; font-size: 22px; font-weight: 900; margin-top: 10px; border-top: 3px solid #000; padding-top: 10px; color: #000; } .footer { text-align: center; margin-top: 20px; font-size: 14px; font-weight: 900; color: #000; padding-bottom: 20px; } .cut-line { border-top: 2px dashed #000; margin: 30px 0; width: 100%; position: relative; text-align: center; } .cut-line span { background: #fff; padding: 0 10px; position: relative; top: -10px; font-size: 12px; font-weight: 900; color: #000; }</style></head><body>${gerarVia("VIA DO ESTABELECIMENTO")}<div class="cut-line"><span>✂️ CORTAR AQUI ✂️</span></div>${gerarVia("VIA DO CLIENTE")}<script>window.onload = () => { window.print(); }</script></body></html>`;
        JANELAPRINT.document.write(html); JANELAPRINT.document.close();
    } catch (e) { console.error(e); }
}

async function imprimirRelatorioCaixa() { /* Omitido */ }