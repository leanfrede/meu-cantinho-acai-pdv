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
let taxaEntregaConfigurada = 3.00; 
let indexSendoEditado = null;
let listaClientesGlobal = []; // Memória do CRM

let caixaAberto = localStorage.getItem('caixa_aberto') === 'true';
let fundoDeTroco = parseFloat(localStorage.getItem('caixa_fundo')) || 0;

let chartInstHoras = null;
let chartInstProdutos = null;
let chartInstAdicionais = null;

const DICIONARIO_SOCIOS = {
    "1111": "Sócio A",
    "2222": "Sócio B"
};
let pinDigitado = "";

function formatarDataHora(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resConfig = await fetch('/api/config');
        const config = await resConfig.json();
        if (config.taxaEntregaPadrao !== undefined) {
            taxaEntregaConfigurada = parseFloat(config.taxaEntregaPadrao);
            const elTaxaAdmin = document.getElementById('config-taxa-entrega');
            if (elTaxaAdmin) elTaxaAdmin.value = taxaEntregaConfigurada.toFixed(2);
        }
    } catch(e) { console.error(e); }

    if (document.getElementById('product-grid')) {
        carregarProdutos();
        carregarAlertaPedidosOnline();
        setInterval(carregarAlertaPedidosOnline, 5000);
    }
    
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

    if (pinDigitado.length === 4) setTimeout(verificarPin, 200);
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
    carregarGraficosDashboard();
    carregarCRM(); // Carrega o novo cérebro de marketing
    
    const hojeStr = new Date().toISOString().split('T')[0];
    const elIni = document.getElementById('data-inicio-filter');
    const elFim = document.getElementById('data-fim-filter');
    if (elIni && !elIni.value) elIni.value = hojeStr;
    if (elFim && !elFim.value) elFim.value = hojeStr;
}

function fazerLogoutAdmin() {
    sessionStorage.removeItem('admin_autenticado');
    sessionStorage.removeItem('admin_usuario');
    window.location.reload();
}

function sairParaCaixa() { window.location.href = "index.html"; }

async function salvarTaxaEntregaAdmin() {
    const novaTaxa = parseFloat(document.getElementById('config-taxa-entrega').value);
    if (isNaN(novaTaxa) || novaTaxa < 0) { alert("⚠️ Digite um valor de taxa válido!"); return; }

    try {
        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxaEntregaPadrao: novaTaxa })
        });
        if (res.ok) {
            taxaEntregaConfigurada = novaTaxa;
            alert(`✅ Sucesso! A taxa de entrega da loja foi alterada para R$ ${novaTaxa.toFixed(2)}.`);
        }
    } catch(e) { console.error(e); }
}

// ==========================================================================
// NOVO MÓDULO: CRM INTELIGENTE & MARKETING DE RESGATE
// ==========================================================================
async function carregarCRM() {
    try {
        const res = await fetch('/api/clientes');
        listaClientesGlobal = await res.json();
        // Por padrão, mostra os clientes sumidos
        renderizarCRM('sumidos');
    } catch (e) { console.error("Erro ao carregar CRM:", e); }
}

function filtrarCRM(tipo, elemBotao) {
    if (elemBotao) {
        document.querySelectorAll('.crm-tab-btn').forEach(btn => btn.classList.remove('active'));
        elemBotao.classList.add('active');
    }
    renderizarCRM(tipo);
}

function renderizarCRM(tipo) {
    const boxLista = document.getElementById('crm-lista-clientes');
    if (!boxLista) return;
    boxLista.innerHTML = '';

    if (listaClientesGlobal.length === 0) {
        boxLista.innerHTML = '<div style="padding: 30px; text-align: center; color: #868e96;">Nenhum cliente cadastrado ainda. As fichas serão criadas automaticamente conforme as vendas acontecerem!</div>';
        return;
    }

    let listaFiltrada = [...listaClientesGlobal];

    if (tipo === 'sumidos') {
        // Filtra clientes sem comprar há pelo menos 15 dias (e que já compraram pelo menos 1 vez)
        listaFiltrada = listaFiltrada.filter(c => c.diasSumido >= 15 && c.pedidos > 0);
        listaFiltrada.sort((a, b) => b.diasSumido - a.diasSumido); // Os mais sumidos primeiro
    } else if (tipo === 'vip') {
        // Ordena pelos que mais gastaram na loja
        listaFiltrada.sort((a, b) => b.totalGasto - a.totalGasto);
    } else {
        // Ordem alfabética para "Todos"
        listaFiltrada.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    if (listaFiltrada.length === 0) {
        let msg = "Nenhum cliente encontrado neste filtro.";
        if (tipo === 'sumidos') msg = "🎉 Parabéns! Você não tem clientes sumidos há mais de 15 dias!";
        boxLista.innerHTML = `<div style="padding: 30px; text-align: center; color: #2b9348; font-weight: bold;">${msg}</div>`;
        return;
    }

    listaFiltrada.forEach(c => {
        const div = document.createElement('div');
        div.className = 'crm-item';
        
        let badgeStatus = `<span style="background: #eafaf1; color: #2b9348; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">Comprou há ${c.diasSumido} dia(s)</span>`;
        if (c.diasSumido >= 30) {
            badgeStatus = `<span style="background: #ffe5d9; color: #d62828; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">🚨 Sumido há ${c.diasSumido} dias</span>`;
        } else if (c.diasSumido >= 15) {
            badgeStatus = `<span style="background: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">⚠️ Ausente há ${c.diasSumido} dias</span>`;
        }

        div.innerHTML = `
            <div>
                <strong style="color: #343a40; font-size: 15px;">${c.nome}</strong> ${badgeStatus}<br>
                <small style="color: #666;">📱 WhatsApp: <b>${c.telefone}</b> | 🛵 Endereço: ${c.endereco}</small><br>
                <small style="color: #4a0072; font-weight: bold;">🍧 Total na Loja: R$ ${c.totalGasto.toFixed(2)} (${c.pedidos} pedidos executados)</small>
            </div>
            <div>
                <button onclick="abrirWhatsAppResgate('${c.telefone}', '${c.nome}', ${c.diasSumido})" style="background: #25d366; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 5px rgba(37,211,102,0.3);">
                    💬 Chamar com Cupom
                </button>
            </div>
        `;
        boxLista.appendChild(div);
    });
}

function abrirWhatsAppResgate(telefone, nome, dias) {
    let foneLimpo = telefone.replace(/\D/g, '');
    if (foneLimpo.length === 10 || foneLimpo.length === 11) foneLimpo = '55' + foneLimpo;

    const primeiroNome = nome.split(' ')[0] !== "Cliente" ? nome.split(' ')[0] : "amigo(a)";
    
    const texto = `Olá, *${primeiroNome}*! Aqui é do *Meu Cantinho Açaí* 🔮🍧\n\nNossa equipe percebeu que faz um tempinho que você não pede o seu açaí favorito com a gente e estávamos morrendo de saudades!\n\n🎁 Para deixar o seu dia mais cremoso, liberamos um *MIMO ESPECIAL (Entrega Grátis ou Desconto)* exclusivo para o seu WhatsApp hoje!\n\nBasta responder esta mensagem para garantir o seu. Vamos preparar no capricho? ✨`;
    
    window.open(`https://api.whatsapp.com/send?phone=${foneLimpo}&text=${encodeURIComponent(texto)}`, '_blank');
}

// ==========================================================================
// MÁQUINA DO TEMPO (RELATÓRIO POR PERÍODO)
// ==========================================================================
async function gerarRelatorioPeriodo() {
    const dataIniStr = document.getElementById('data-inicio-filter').value;
    const dataFimStr = document.getElementById('data-fim-filter').value;

    if (!dataIniStr || !dataFimStr) {
        alert("⚠️ Por favor, selecione a Data Inicial e a Data Final no calendário para consultar!");
        return;
    }

    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();

        const pedidosFiltrados = orders.filter(o => {
            if (!o.data) return false;
            const dataPed = o.data.split('T')[0];
            return dataPed >= dataIniStr && dataPed <= dataFimStr;
        });

        const boxResumo = document.getElementById('resumo-periodo-box');
        const lista = document.getElementById('lista-pedidos-periodo');
        
        boxResumo.style.display = 'block';
        lista.innerHTML = '';

        if (pedidosFiltrados.length === 0) {
            boxResumo.innerHTML = `<div style="text-align: center; color: #d62828; font-weight: bold;">⚠️ Nenhuma venda encontrada no período de ${dataIniStr.split('-').reverse().join('/')} até ${dataFimStr.split('-').reverse().join('/')}.</div>`;
            lista.innerHTML = '<div style="padding:15px; color:#868e96; text-align:center;">Sem dados para exibir.</div>';
            return;
        }

        const vendasValidas = pedidosFiltrados.filter(o => o.status !== 'Cancelado');
        const totalVendas = vendasValidas.reduce((acc, cur) => acc + cur.total, 0);
        const vendasDinheiro = vendasValidas.filter(o => o.formaPagamento.includes('Dinheiro')).reduce((acc, cur) => acc + cur.total, 0);
        const vendasPIX = vendasValidas.filter(o => o.formaPagamento.includes('PIX')).reduce((acc, cur) => acc + cur.total, 0);
        const vendasCartao = vendasValidas.filter(o => o.formaPagamento.includes('Cartão')).reduce((acc, cur) => acc + cur.total, 0);
        const totalEntrega = vendasValidas.reduce((acc, cur) => acc + (cur.taxaEntrega || 0), 0);
        const totalCancelados = pedidosFiltrados.filter(o => o.status === 'Cancelado').length;

        boxResumo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div>
                    <span style="font-size: 13px; color: #666; font-weight: bold;">Faturamento Total no Período:</span>
                    <strong style="font-size: 24px; color: #2b9348; display: block; margin: 5px 0;">R$ ${totalVendas.toFixed(2)}</strong>
                    <small style="color: #666; font-weight: bold;">✔ ${vendasValidas.length} pedidos concluídos | ❌ ${totalCancelados} cancelados</small>
                </div>
                <div style="font-size: 13px; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; min-width: 180px;">
                    <div style="margin-bottom: 4px;">💵 Em Dinheiro: <b style="float: right;">R$ ${vendasDinheiro.toFixed(2)}</b></div>
                    <div style="margin-bottom: 4px;">⚡ Em PIX: <b style="float: right;">R$ ${vendasPIX.toFixed(2)}</b></div>
                    <div style="margin-bottom: 4px;">💳 Em Cartão: <b style="float: right;">R$ ${vendasCartao.toFixed(2)}</b></div>
                    <div style="border-top: 1px dashed #ccc; margin-top: 6px; padding-top: 6px; color: #0077b6; font-weight: bold;">🛵 Taxas de Entrega: <span style="float: right;">R$ ${totalEntrega.toFixed(2)}</span></div>
                </div>
            </div>
        `;

        pedidosFiltrados.reverse().forEach(o => {
            const div = document.createElement('div');
            div.style = "padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
            const lblEntrega = o.tipoPedido.includes('Entrega') ? '🛵' : '🏪';
            
            let statusBadge = `<span style="font-size:12px; font-weight:bold; color:${o.status === 'Pronto' ? '#2b9348' : '#ffc107'}">${(o.status || 'Pendente').toUpperCase()}</span>`;
            let corTotal = '#2b9348';
            let botoesAcao = `<button onclick="reimprimirCupomCliente(${o.id})" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Reimprimir Cupom">🖨️</button>`;

            if (o.status === 'Cancelado') {
                const dataCancelado = o.canceladoEm ? ` às ${formatarDataHora(o.canceladoEm).split(' ')[1]}` : '';
                const motivoStr = o.motivoCancelamento ? `<br><span style="color:#c92a2a; font-size:11px;"><b>Motivo:</b> ${o.motivoCancelamento}</span>` : '';
                statusBadge = `<span style="font-size:11px; font-weight:bold; color:#dc3545;">⚠️ ESTORNADO POR: ${o.canceladoPor || 'Gerente'}${dataCancelado}</span>${motivoStr}`;
                corTotal = '#868e96';
            }

            div.innerHTML = `
                <div>
                    <strong>Pedido #${o.id} ${lblEntrega} (${o.formaPagamento}) - ${statusBadge}</strong><br>
                    <small style="color:#4a0072; font-weight:bold;">📅 ${formatarDataHora(o.data)} ${o.origem === 'Online' ? '🌐 ONLINE' : ''}</small><br>
                    <small style="color:#666;">${o.itens.map(i => i.name).join(', ')}</small>
                </div>
                <div style="text-align:right;">
                    <strong style="color:${corTotal}; display:block; font-size:15px;">R$ ${o.total.toFixed(2)}</strong>
                    ${botoesAcao}
                </div>
            `;
            lista.appendChild(div);
        });

    } catch(e) { console.error("Erro ao gerar relatório de período:", e); }
}

// ==========================================================================
// MONITOR DE ALERTA DE PEDIDOS DO CARDÁPIO ONLINE (FRENTE DE CAIXA)
// ==========================================================================
async function carregarAlertaPedidosOnline() {
    const barra = document.getElementById('alerta-pedidos-online');
    const botoes = document.getElementById('lista-botoes-online');
    const txt = document.getElementById('txt-alerta-online');
    if (!barra) return;

    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        const pendentesOnline = orders.filter(o => o.origem === 'Online' && o.status === 'Pendente');

        if (pendentesOnline.length === 0) {
            barra.style.display = 'none';
            return;
        }

        barra.style.display = 'flex';
        txt.innerText = `🔔 ${pendentesOnline.length} novo(s) pedido(s) vindo do Cardápio Digital!`;
        botoes.innerHTML = '';

        pendentesOnline.forEach(o => {
            const btn = document.createElement('button');
            btn.style = "background: #2b9348; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2);";
            btn.innerText = `✔ Aprovar #${o.id} (${o.nomeClienteOnline || 'Cliente'}) - R$ ${o.total.toFixed(2)}`;
            btn.onclick = () => aprovarPedidoOnline(o);
            botoes.appendChild(btn);
        });

    } catch(e) { console.error("Erro ao checar online:", e); }
}

async function aprovarPedidoOnline(pedido) {
    const confirmacao = confirm(
        `🚨 APROVAR PEDIDO ONLINE #${pedido.id}\n` +
        `-----------------------------------------\n` +
        `👤 Cliente: ${pedido.nomeClienteOnline || 'Web'}\n` +
        `🛵 Tipo: ${pedido.tipoPedido}\n` +
        `💰 Total: R$ ${pedido.total.toFixed(2)} (Taxa de entrega R$ ${pedido.taxaEntrega.toFixed(2)} inclusa)\n` +
        `💳 Pagamento escolhido: ${pedido.formaPagamento}\n` +
        `-----------------------------------------\n` +
        `Deseja confirmar a entrada deste pedido no caixa e liberar para a cozinha?`
    );

    if (!confirmacao) return;

    try {
        const res = await fetch(`/api/orders/${pedido.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Pendente' })
        });
        if (res.ok) {
            alert(`✅ Pedido #${pedido.id} aprovado com sucesso! Já está no faturamento do caixa e na tela da cozinha!`);
            carregarAlertaPedidosOnline();
            atualizarTelaCaixa();
            carregarPedidosCozinha();
            carregarCRM(); // Atualiza a ficha do cliente
        }
    } catch(e) { console.error(e); }
}

// ==========================================================================
// FRENTE DE CAIXA (VENDAS COM ESTOQUE INTELIGENTE)
// ==========================================================================
async function carregarProdutos() {
    try {
        const response = await fetch('/api/products');
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
        const estoqueAtual = p.estoque !== undefined ? p.estoque : 50;
        const disponivel = p.available !== false && estoqueAtual > 0;

        if (!disponivel) {
            btn.style.opacity = '0.45'; btn.style.cursor = 'not-allowed'; btn.style.border = '2px dashed #dc3545';
            btn.innerHTML = `<span>${p.name}<br><small style="color:#dc3545; font-weight:bold; font-size:11px;">⚠️ ESGOTADO (0 un.)</small></span><span class="price-tag" style="background:#6c757d; color:white;">R$ ${p.price.toFixed(2)}</span>`;
            btn.onclick = () => alert(`⚠️ Desculpe! O item "${p.name}" acabou no estoque (0 unidades restantes). Peça reposição ao gerente!`);
        } else {
            let alertaEstoque = `<small style="color:#868e96; font-size:11px; display:block; margin-top:3px;">📦 Estoque: ${estoqueAtual} un.</small>`;
            if (estoqueAtual <= 5) {
                alertaEstoque = `<small style="color:#d62828; font-weight:bold; font-size:11px; display:block; margin-top:3px; background:#ffe5d9; padding:2px 4px; border-radius:4px;">⚠️ ÚLTIMAS ${estoqueAtual} UNIDADES!</small>`;
            }

            btn.innerHTML = `<span>${p.name} ${alertaEstoque}</span><span class="price-tag">R$ ${p.price.toFixed(2)}</span>`;
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

function abrirModal(produto) {
    indexSendoEditado = null; 
    produtoSendoConfigurado = produto;
    const modalTitulo = document.getElementById('modal-titulo');
    if (modalTitulo) modalTitulo.innerText = `Personalizar: ${produto.name}`;
    document.querySelectorAll('#modal-conteudo input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    const btnConf = document.querySelector('#modal-produto .btn-modal-confirmar');
    if(btnConf) btnConf.innerText = "Confirmar Receita";

    const modalDiv = document.getElementById('modal-produto');
    if (modalDiv) modalDiv.style.display = 'flex';
}

function fecharModal() { 
    indexSendoEditado = null;
    const btnConf = document.querySelector('#modal-produto .btn-modal-confirmar');
    if(btnConf) btnConf.innerText = "Confirmar Receita";
    const modalDiv = document.getElementById('modal-produto'); 
    if (modalDiv) modalDiv.style.display = 'none'; 
}

function editarDoCarrinho(index) {
    indexSendoEditado = index;
    const item = carrinho[index];
    produtoSendoConfigurado = produtosTodos.find(p => p.id === item.id) || { id: item.id, name: item.name, price: item.price };
    
    const modalTitulo = document.getElementById('modal-titulo');
    if (modalTitulo) modalTitulo.innerText = `Editar: ${item.name}`;
    
    document.querySelectorAll('#modal-conteudo input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    if(item.cremes) item.cremes.forEach(v => { const el = document.querySelector(`input[name="creme"][value="${v}"]`); if(el) el.checked = true; });
    if(item.coberturas) item.coberturas.forEach(v => { const el = document.querySelector(`input[name="cobertura"][value="${v}"]`); if(el) el.checked = true; });
    if(item.acompanhamentos) item.acompanhamentos.forEach(v => { const el = document.querySelector(`input[name="acompanhamento"][value="${v}"]`); if(el) el.checked = true; });
    
    const btnConf = document.querySelector('#modal-produto .btn-modal-confirmar');
    if(btnConf) btnConf.innerText = "✔ Salvar Alterações";
    
    const modalDiv = document.getElementById('modal-produto');
    if (modalDiv) modalDiv.style.display = 'flex';
}

function confirmarAdicao() {
    const cremes = Array.from(document.querySelectorAll('input[name="creme"]:checked')).map(cb => cb.value);
    const coberturas = Array.from(document.querySelectorAll('input[name="cobertura"]:checked')).map(cb => cb.value);
    const acompanhamentos = Array.from(document.querySelectorAll('input[name="acompanhamento"]:checked')).map(cb => cb.value);

    if (cremes.length > 2) { alert("⚠️ Escolha no máximo 2 Cremes."); return; }
    if (coberturas.length > 2) { alert("⚠️ Escolha no máximo 2 Coberturas."); return; }
    if (acompanhamentos.length > 5) { alert("⚠️ Escolha no máximo 5 Acompanhamentos."); return; }

    let observacao = "";
    if (cremes.length > 0) observacao += `Cremes: ${cremes.join(', ')}`;
    if (coberturas.length > 0) observacao += (observacao ? ' | ' : '') + `Cob: ${coberturas.join(', ')}`;
    if (acompanhamentos.length > 0) observacao += (observacao ? ' | ' : '') + `Acomps: ${acompanhamentos.join(', ')}`;
    if (!observacao) observacao = "Copos simples tradicional";

    const novoItem = { 
        id: produtoSendoConfigurado.id, 
        name: produtoSendoConfigurado.name, 
        price: produtoSendoConfigurado.price, 
        obs: observacao,
        cremes: cremes,
        coberturas: coberturas,
        acompanhamentos: acompanhamentos
    };

    if (indexSendoEditado !== null) {
        carrinho[indexSendoEditado] = novoItem;
        indexSendoEditado = null;
    } else {
        carrinho.push(novoItem);
    }

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
            <div class="cart-item-right">
                <span>R$ ${item.price.toFixed(2)}</span>
                <button class="btn-editar-item" onclick="editarDoCarrinho(${index})" title="Editar Item" style="background:none; border:none; cursor:pointer; font-size:14px; margin-right:4px;">✏️</button>
                <button class="btn-remover-item" onclick="removerDoCarrinho(${index})" title="Remover Item">❌</button>
            </div>
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
    
    document.getElementById('telefone-fidelidade').value = '';
    document.getElementById('status-fidelidade').innerText = 'Digite o número para checar os pontos...';
    document.getElementById('status-fidelidade').style.color = '#4a0072';

    document.getElementById('modal-pagamento').style.display = 'flex';
}

function fecharModalPagamento() { document.getElementById('modal-pagamento').style.display = 'none'; }

function alternarTipoPedido() {
    const tipo = document.getElementById('pedido-tipo').value;
    const divTaxa = document.getElementById('div-taxa-entrega');
    if (tipo === 'Entrega') {
        divTaxa.style.display = 'block';
        document.getElementById('taxa-entrega').value = taxaEntregaConfigurada.toFixed(2);
    } else { 
        divTaxa.style.display = 'none'; 
        document.getElementById('taxa-entrega').value = ''; 
    }
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

async function verificarFidelidade() {
    const tel = document.getElementById('telefone-fidelidade').value.replace(/\D/g, '');
    if(tel.length < 10) {
        alert("⚠️ Digite um telefone válido com DDD.");
        return;
    }
    try {
        const res = await fetch(`/api/clientes/${tel}`);
        const data = await res.json();
        const numPedidos = data.pedidos || 0;
        const divStatus = document.getElementById('status-fidelidade');
        
        let txtExtra = "";
        if (data.dados && data.dados.nome && data.dados.nome !== "Cliente Balcão") {
            txtExtra = ` | 👤 <b>${data.dados.nome}</b>`;
        }

        if(numPedidos >= 9) {
            divStatus.innerHTML = `🎉 UAU! Este é o 10º pedido! O cliente GANHOU o Açaí de 300ml!${txtExtra}`;
            divStatus.style.color = '#d62828';
        } else {
            divStatus.innerHTML = `🌟 O cliente já tem ${numPedidos} pedido(s) salvo(s). Faltam ${10 - numPedidos} para o prêmio.${txtExtra}`;
            divStatus.style.color = '#2b9348';
        }
    } catch(e) { console.error(e); }
}

async function confirmarVendaComPagamento() {
    const metodo = document.getElementById('pagamento-metodo').value;
    const recebido = parseFloat(document.getElementById('pagamento-recebido').value) || 0;
    const tipoPed = document.getElementById('pedido-tipo').value;
    const taxaPed = parseFloat(document.getElementById('taxa-entrega').value) || 0;
    
    const telefoneFidelidadeRaw = document.getElementById('telefone-fidelidade').value.replace(/\D/g, '');
    const telefoneFidelidadeFinal = telefoneFidelidadeRaw.length >= 10 ? telefoneFidelidadeRaw : null;

    if (metodo === 'Dinheiro' && recebido < totalVendaAtual) { alert("⚠️ O valor entregue é insuficiente!"); return; }

    const troco = metodo === 'Dinheiro' ? (recebido - totalVendaAtual) : 0;
    const dadosVenda = {
        itens: carrinho, total: totalVendaAtual, formaPagamento: metodo,
        valorRecebido: metodo === 'Dinheiro' ? recebido : totalVendaAtual, troco: troco,
        tipoPedido: tipoPed, taxaEntrega: taxaPed, clienteFidelidade: telefoneFidelidadeFinal, data: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosVenda) });
        if (response.ok) {
            ultimoPedidoSalvo = await response.json();
            carrinho = []; atualizarCarrinhoUI(); fecharModalPagamento();
            document.getElementById('whatsapp-cliente').value = telefoneFidelidadeFinal ? telefoneFidelidadeFinal : '';
            document.getElementById('modal-sucesso').style.display = 'flex';
            carregarProdutos();
            carregarCRM(); // Atualiza em tempo real as estatísticas no CRM
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
    if (ultimoPedidoSalvo.tipoPedido.includes('Entrega')) msg += `*Taxa de Entrega:* R$ ${ultimoPedidoSalvo.taxaEntrega.toFixed(2)}\n`;
    msg += `*Forma de Pagto:* ${ultimoPedidoSalvo.formaPagamento}\n`;
    if (ultimoPedidoSalvo.formaPagamento === 'Dinheiro') msg += `*Valor Entregue:* R$ ${ultimoPedidoSalvo.valorRecebido.toFixed(2)}\n*Troco Devolvido:* R$ ${ultimoPedidoSalvo.troco.toFixed(2)}\n`;
    msg += `*VALOR TOTAL: R$ ${ultimoPedidoSalvo.total.toFixed(2)}*\n-----------------------------\n`;
    
    if (ultimoPedidoSalvo.pontosAtuais) {
        msg += `🎁 *CLUBE FIDELIDADE:*\nVocê tem *${ultimoPedidoSalvo.pontosAtuais}* pedido(s).\nComplete 10 e ganhe um Açaí 300ml!\n-----------------------------\n`;
    }

    msg += `_Obrigado pela preferência! Volte sempre!_ ✨🍧`;
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
        await fetch('/api/caixa', { 
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': socioResponsavel }, 
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
        const response = await fetch('/api/orders');
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
            const badgeClass = p.tipoPedido.includes('Entrega') ? 'pedido-badge-entrega' : 'pedido-badge-balcao';
            const badgeTexto = p.tipoPedido.includes('Entrega') ? '🛵 ENTREGA' : '🏪 BALCÃO';

            let itensHtml = '';
            p.itens.forEach(i => { itensHtml += `<div class="item-linha-cozinha"><strong>📦 1x ${i.name}</strong><p>📋 ${i.obs}</p></div>`; });

            const horaPedido = new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div>
                    <div class="pedido-topo"><span style="font-weight:bold; font-size:16px;">Comanda #${p.id} ${p.origem === 'Online' ? '🌐 ONLINE' : ''}</span><span class="${badgeClass}">${badgeTexto}</span></div>
                    <div style="font-size:13px; color:#868e96; margin-bottom:12px;">⏰ Recebido às: ${horaPedido} ${p.nomeClienteOnline ? `| Cliente: <b>${p.nomeClienteOnline}</b>` : ''}</div>
                    <div style="background:#fff3cd; color:#856404; padding:6px 8px; border-radius:6px; font-size:13px; margin-bottom:10px; font-weight:bold;">💰 Pagamento: ${p.formaPagamento}</div>
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
        const response = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Pronto' }) });
        if (response.ok) carregarPedidosCozinha();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// MÓDULO INTELIGENTE: DASHBOARD DE GRÁFICOS (CHART.JS)
// ==========================================================================
async function carregarGraficosDashboard() {
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        const vendasValidas = orders.filter(o => o.status !== 'Cancelado');

        let contagemHoras = {};
        let contagemProdutos = {};
        let contagemAdicionais = {};

        vendasValidas.forEach(o => {
            let dataOrder = new Date(o.data);
            let hora = dataOrder.getHours() + "h";
            contagemHoras[hora] = (contagemHoras[hora] || 0) + 1;

            o.itens.forEach(item => {
                contagemProdutos[item.name] = (contagemProdutos[item.name] || 0) + 1;

                if (item.obs && item.obs !== "Copos simples tradicional") {
                    let partes = item.obs.split('|'); 
                    partes.forEach(parte => {
                        let pedacos = parte.split(':'); 
                        if (pedacos.length > 1) {
                            let ingredientes = pedacos[1].split(',');
                            ingredientes.forEach(ing => {
                                let nomeLimpo = ing.trim();
                                if (nomeLimpo) contagemAdicionais[nomeLimpo] = (contagemAdicionais[nomeLimpo] || 0) + 1;
                            });
                        }
                    });
                }
            });
        });

        const getTopRanking = (obj, limite) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limite);
        const topProdutos = getTopRanking(contagemProdutos, 5); 
        const topAdicionais = getTopRanking(contagemAdicionais, 7); 
        const horasOrdenadas = Object.entries(contagemHoras).sort((a, b) => parseInt(a[0]) - parseInt(b[0])); 

        if (chartInstHoras) chartInstHoras.destroy();
        const ctxH = document.getElementById('graficoHoras');
        if (ctxH) {
            chartInstHoras = new Chart(ctxH, {
                type: 'line',
                data: {
                    labels: horasOrdenadas.map(x => x[0]),
                    datasets: [{ label: 'Pedidos por Hora', data: horasOrdenadas.map(x => x[1]), borderColor: '#4a0072', backgroundColor: 'rgba(74, 0, 114, 0.1)', fill: true, tension: 0.3 }]
                }
            });
        }

        if (chartInstProdutos) chartInstProdutos.destroy();
        const ctxP = document.getElementById('graficoProdutos');
        if (ctxP) {
            chartInstProdutos = new Chart(ctxP, {
                type: 'doughnut',
                data: {
                    labels: topProdutos.map(x => x[0]),
                    datasets: [{ data: topProdutos.map(x => x[1]), backgroundColor: ['#4a0072', '#0077b6', '#2b9348', '#ffc107', '#d62828'] }]
                }
            });
        }

        if (chartInstAdicionais) chartInstAdicionais.destroy();
        const ctxA = document.getElementById('graficoAdicionais');
        if (ctxA) {
            chartInstAdicionais = new Chart(ctxA, {
                type: 'bar',
                data: {
                    labels: topAdicionais.map(x => x[0]),
                    datasets: [{ label: 'Vezes escolhido', data: topAdicionais.map(x => x[1]), backgroundColor: '#0077b6' }]
                }
            });
        }

    } catch(e) { console.error("Erro ao carregar Dashboard:", e); }
}

// ==========================================================================
// PAINEL ADMINISTRATIVO COM REPOSIÇÃO DE ESTOQUE
// ==========================================================================
async function carregarProdutosAdmin() {
    const lista = document.getElementById('lista-produtos');
    if (!lista) return;
    try {
        const response = await fetch('/api/products');
        const produtos = await response.json();
        lista.innerHTML = '';
        produtos.forEach(p => {
            const estoqueAtual = p.estoque !== undefined ? p.estoque : 50;
            const disponivel = p.available !== false && estoqueAtual > 0;
            const statusTexto = disponivel ? '🟢 Ativo' : '🔴 Esgotado';
            const statusCor = disponivel ? '#2b9348' : '#dc3545';
            const div = document.createElement('div');
            
            const dataStr = p.dataAtividade ? ` em ${formatarDataHora(p.dataAtividade)}` : '';
            const responsavelStr = p.usuarioAtividade ? `(Por: ${p.usuarioAtividade}${dataStr})` : '';

            let corEstoque = '#2b9348';
            if (estoqueAtual <= 5) corEstoque = '#d62828';

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <div>
                        <strong>${p.name}</strong> <span style="font-size:11px; background:#eeb4ff; padding:2px 6px; border-radius:10px;">${p.category}</span>
                        <div style="font-size:12px; color:#666;">
                            R$ ${p.price.toFixed(2)} | <strong style="color:${corEstoque};">Estoque: ${estoqueAtual} un.</strong>
                            <br><span style="color:#0077b6; font-weight:bold; font-size:11px;">${responsavelStr}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button onclick="reporEstoque(${p.id}, '${p.name}')" style="background:#0077b6; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:bold; cursor:pointer;" title="Chegou mercadoria nova?">📦 Repor</button>
                        <button onclick="alternarStatusProduto(${p.id}, ${disponivel})" style="background:${statusCor}; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">${statusTexto}</button>
                        <button onclick="editarProduto(${p.id}, '${p.name}', ${p.price})" style="background:#ffc107; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button onclick="excluirProduto(${p.id})" style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
            lista.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function reporEstoque(id, nomeProduto) {
    const qtdStr = prompt(`📦 Reposição de Estoque para: "${nomeProduto}"\n\nQuantas unidades extras chegaram da rua/fornecedor?`);
    if (!qtdStr) return;
    const qtd = parseInt(qtdStr);
    if (isNaN(qtd) || qtd <= 0) { alert("⚠️ Digite uma quantidade válida!"); return; }

    try {
        const response = await fetch(`/api/products/${id}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, 
            body: JSON.stringify({ adicionarEstoque: qtd }) 
        });
        if (response.ok) {
            alert(`✅ Sucesso! +${qtd} unidades somadas ao estoque de "${nomeProduto}".`);
            carregarProdutosAdmin();
        }
    } catch (error) { console.error(error); }
}

async function alternarStatusProduto(id, statusAtual) {
    try {
        const response = await fetch(`/api/products/${id}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, 
            body: JSON.stringify({ available: !statusAtual }) 
        });
        if (response.ok) carregarProdutosAdmin();
    } catch (error) { console.error(error); }
}

async function carregarHistoricoVendas() {
    const lista = document.getElementById('historico-vendas');
    if (!lista) return;
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        const hoje = new Date().toISOString().split('T')[0];
        const ordHoje = orders.filter(o => o.data.startsWith(hoje));

        lista.innerHTML = '';
        if (ordHoje.length === 0) { lista.innerHTML = '<div style="padding:15px; color:#868e96;">Nenhuma venda realizada hoje.</div>'; return; }
        
        ordHoje.reverse().forEach(o => {
            const div = document.createElement('div');
            div.style = "padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
            const lblEntrega = o.tipoPedido.includes('Entrega') ? '🛵' : '🏪';
            
            let statusBadge = `<span style="font-size:12px; font-weight:bold; color:${o.status === 'Pronto' ? '#2b9348' : '#ffc107'}">${(o.status || 'Pendente').toUpperCase()}</span>`;
            let corTotal = '#2b9348';
            let botoesAcao = `<button onclick="reimprimirCupomCliente(${o.id})" style="background:none; border:none; cursor:pointer; font-size:14px;">🖨️</button> <button onclick="cancelarVendaAdmin(${o.id})" style="background:none; border:none; cursor:pointer; font-size:14px; margin-left:8px;" title="Estornar Venda">🗑️</button>`;

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

async function reimprimirCupomCliente(id) {
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        const o = orders.find(order => order.id === id);
        if (!o) return;

        const JANELAPRINT = window.open('', '_blank', 'width=350,height=600');
        let itensHtml = '';
        o.itens.forEach(i => { itensHtml += `<div style="margin-bottom:8px;"><strong>1x ${i.name}</strong><br><strong>${i.obs}</strong><br><strong>R$ ${i.price.toFixed(2)}</strong></div>`; });

        JANELAPRINT.document.write(`
            <html><body style="font-family:monospace;width:280px;font-size:13px;margin:10px; color:#000;">
            <center><strong>MEU CANTINHO AÇAÍ</strong><br><strong>COMPROVANTE DE PEDIDO</strong><br><strong>Pedido #${o.id} (${o.tipoPedido})</strong><br><strong>${new Date(o.data).toLocaleString('pt-BR')}</strong></center><hr style="border-top:1px dashed #000;">
            ${itensHtml}<hr style="border-top:1px dashed #000;">
            ${o.tipoPedido.includes('Entrega') ? `<strong>Taxa Entrega: R$ ${o.taxaEntrega.toFixed(2)}</strong><br>` : ''}
            <strong>FORMA PAGTO: ${o.formaPagamento}</strong><br>
            <strong>STATUS: ${(o.status || '').toUpperCase()} ${o.status === 'Cancelado' ? `por ${o.canceladoPor}` : ''}</strong><br>
            <strong>VALOR TOTAL: R$ ${o.total.toFixed(2)}</strong><script>window.onload = function() { window.print(); }</script></body></html>
        `);
        JANELAPRINT.document.close();
    } catch (e) { console.error(e); }
}

async function cancelarVendaAdmin(id) {
    if (!confirm("⚠️ Tem certeza que deseja CANCELAR e estornar este pedido? Os itens vendidos VOLTARÃO AUTOMATICAMENTE para o estoque.")) return;
    const motivo = prompt("📝 Digite obrigatoriamente o motivo/observação deste cancelamento:");
    if (motivo === null) return; 
    if (motivo.trim() === "") { alert("❌ Erro: O motivo do cancelamento não pode ficar em branco!"); return; }

    try {
        const response = await fetch(`/api/orders/${id}`, { 
            method: 'DELETE', headers: { 'X-Usuario': sessionStorage.getItem('admin_usuario'), 'X-Motivo': motivo }
        });
        if (response.ok) { 
            alert("✅ Venda cancelada e estornada! Os itens foram devolvidos ao estoque contábil."); 
            carregarHistoricoVendas(); 
            atualizarTelaCaixa(); 
            carregarGraficosDashboard();
            carregarProdutosAdmin();
            carregarCRM();
        }
    } catch (e) { console.error(e); }
}

async function carregarMovimentacoesCaixa() {
    const listaAlvo = document.getElementById('extrato-caixa');
    if (!listaAlvo) return;
    try {
        const res = await fetch('/api/caixa');
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
        const resOrders = await fetch('/api/orders');
        const orders = await resOrders.json();
        const resCaixa = await fetch('/api/caixa');
        const movs = await resCaixa.json();

        const hoje = new Date().toISOString().split('T')[0];
        const ordHoje = orders.filter(o => o.data.startsWith(hoje) && o.status !== 'Cancelado');
        
        const totalVendas = ordHoje.reduce((acc, cur) => acc + cur.total, 0);
        const totalSuprimentos = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'suprimento').reduce((acc, cur) => acc + cur.valor, 0);
        const totalSangrias = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'sangria').reduce((acc, cur) => acc + cur.valor, 0);

        const vendasDinheiro = ordHoje.filter(o => o.formaPagamento.includes('Dinheiro')).reduce((acc, cur) => acc + cur.total, 0);
        const vendasPIX = ordHoje.filter(o => o.formaPagamento.includes('PIX')).reduce((acc, cur) => acc + cur.total, 0);
        const vendasCartao = ordHoje.filter(o => o.formaPagamento.includes('Cartão')).reduce((acc, cur) => acc + cur.total, 0);
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
    const estoque = parseInt(document.getElementById('estoque-produto')?.value) || 50;
    if (!name || !category || isNaN(price)) return;
    
    await fetch('/api/products', { 
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, 
        body: JSON.stringify({ name, category, price, estoque }) 
    });
    
    document.getElementById('nome-produto').value = '';
    document.getElementById('preco-produto').value = '';
    document.getElementById('estoque-produto').value = '50';
    carregarProdutosAdmin();
}

async function excluirProduto(id) {
    if (confirm("Excluir item?")) { await fetch(`/api/products/${id}`, { method: 'DELETE' }); carregarProdutosAdmin(); }
}

function editarProduto(id, n, p) {
    const nn = prompt("Nome:", n); const np = parseFloat(prompt("Preço:", p));
    if (!nn || isNaN(np)) return;
    
    fetch(`/api/products/${id}`, { 
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Usuario': sessionStorage.getItem('admin_usuario') }, 
        body: JSON.stringify({ name: nn, price: np }) 
    }).then(() => carregarProdutosAdmin());
}

async function imprimirRelatorioCaixa() {
    const resOrders = await fetch('/api/orders'); const orders = await resOrders.json();
    const resCaixa = await fetch('/api/caixa'); const movs = await resCaixa.json();
    const hoje = new Date().toISOString().split('T')[0];
    
    const ordHoje = orders.filter(o => o.data.startsWith(hoje) && o.status !== 'Cancelado');
    const totalVendas = ordHoje.reduce((acc, cur) => acc + cur.total, 0);
    const totalSuprimentos = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'suprimento').reduce((acc, cur) => acc + cur.valor, 0);
    const totalSangrias = movs.filter(m => m.data.startsWith(hoje) && m.tipo === 'sangria').reduce((acc, cur) => acc + cur.valor, 0);
    
    const vendasDinheiro = ordHoje.filter(o => o.formaPagamento.includes('Dinheiro')).reduce((acc, cur) => acc + cur.total, 0);
    const vendasPIX = ordHoje.filter(o => o.formaPagamento.includes('PIX')).reduce((acc, cur) => acc + cur.total, 0);
    const vendasCartao = ordHoje.filter(o => o.formaPagamento.includes('Cartão')).reduce((acc, cur) => acc + cur.total, 0);
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