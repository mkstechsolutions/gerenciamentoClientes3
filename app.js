// ==========================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==========================================
// Certifique-se de atualizar esta URL caso tenha gerado uma Nova Implantação
window.WEB_APP_URL = window.WEB_APP_URL || "https://script.google.com/macros/s/AKfycbyhF4ME2RPaObEofW7072DAwmdLSOdkQSNC-3pa4N9zCVSh3PyXeaLasRVwalrs0MFc/exec"; 

let SENHA_USUARIO = "";
let DADOS_BRUTOS = [];
let indexPlanilhaGlobal = -1;
let saldoDevedorGlobal = "0,00";
let meuGraficoMensal = null;
let meuGraficoFiltro = null;
let clienteEditandoIndex = -1;
let bloqueado = false;
let tempoInatividade = null;

// ==========================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const sel = document.getElementById('n_parc');
    if (sel) {
        sel.innerHTML = '';
        for (let i = 1; i <= 36; i++) {
            sel.innerHTML += `<option value="${i}">${i}x</option>`;
        }
    }

    const inputSenha = document.getElementById('input-senha');
    if (inputSenha) {
        inputSenha.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fazerLogin();
        });
    }

    const inputsTel = ['n_tel', 'edit_tel'];
    inputsTel.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));
        }
    });

    const inputsMoeda = ['n_valor', 'n_entrada', 'n_lucro', 'edit_valor', 'edit_lucro'];
    inputsMoeda.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => formatarInputMoeda(e.target));
        }
    });

    const inputsCalculo = ['n_valor', 'n_entrada', 'n_parc'];
    inputsCalculo.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calcularValorParcelaAutomatico);
            el.addEventListener('change', calcularValorParcelaAutomatico);
        }
    });

    const inputBusca = document.getElementById('busca');
    if (inputBusca) {
        inputBusca.addEventListener('input', filtrarTudo);
    }

    const filtroAno = document.getElementById('filtroAnoGrafico');
    if (filtroAno) {
        filtroAno.addEventListener('change', atualizarGraficoFiltro);
    }

    const filtroMes = document.getElementById('filtroMesGrafico');
    if (filtroMes) {
        filtroMes.addEventListener('change', atualizarGraficoFiltro);
    }

    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evento => {
        document.addEventListener(evento, resetarTimerInatividade, true);
    });
});

// ==========================================
// CONTROLE DE INATIVIDADE
// ==========================================
function resetarTimerInatividade() {
    clearTimeout(tempoInatividade);
    if (SENHA_USUARIO) {
        tempoInatividade = setTimeout(() => {
            if (SENHA_USUARIO) {
                fazerLogout();
                showToast("Sessão expirada por inatividade", true);
            }
        }, 600000); // 10 minutos
    }
}

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return texto
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(msg, error = false) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if (!t) return;
    
    if (msgEl) msgEl.innerText = msg;
    
    t.className = error 
        ? "bg-red-600/90 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3 border border-red-400/30 backdrop-blur-md show"
        : "bg-emerald-600/90 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3 border border-emerald-400/30 backdrop-blur-md show";
    
    setTimeout(() => t.classList.remove('show'), 3500);
}

function aplicarMascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    
    if (v.length > 10) {
        input.value = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (v.length > 6) {
        input.value = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (v.length > 2) {
        input.value = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else {
        input.value = v;
    }
}

function formatarInputMoeda(i) {
    if (!i || typeof i.value === 'undefined') return;
    let v = i.value.replace(/\D/g, '');
    if (v === "") { 
        i.value = ""; 
        calcularValorParcelaAutomatico();
        return; 
    }
    v = (parseFloat(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    i.value = v;
    
    calcularValorParcelaAutomatico();
}

function limparValorParaEnvio(texto) {
    if (texto === null || texto === undefined || texto === "") return 0;
    let str = texto.toString().replace("R$", "").replace(/\s/g, "").trim();
    let limpo = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
}

function converterData(str) {
    if (!str) return new Date();
    const s = str.toString().trim();
    
    if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) {
            return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
        }
    } else if (s.includes('-')) {
        const p = s.split('-');
        if (p.length === 3) {
            return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        }
    }
    
    const parsed = Date.parse(s);
    return isNaN(parsed) ? new Date() : new Date(parsed);
}

function travarInterface(status) {
    bloqueado = status;
    const bts = ['btnSair', 'btnReload', 'btnHist', 'btnNovo', 'btnConfirmar', 'btnSairModalPag', 'btnSalvar', 'btnCancelaNovo', 'btnQuitarTudo', 'btnSalvarEdit'];
    bts.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = status;
            if (status) el.classList.add('loading-state');
            else el.classList.remove('loading-state');
        }
    });
}

function calcularValorParcelaAutomatico() {
    const valorTotal = limparValorParaEnvio(document.getElementById('n_valor')?.value || '0');
    const entrada = limparValorParaEnvio(document.getElementById('n_entrada')?.value || '0');
    const numParcelas = parseInt(document.getElementById('n_parc')?.value || '1', 10);

    const saldoAReparar = Math.max(0, valorTotal - entrada);
    const valorParcela = numParcelas > 0 ? (saldoAReparar / numParcelas) : 0;

    const campoValParc = document.getElementById('n_val_parc');
    if (campoValParc) {
        campoValParc.value = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

// ==========================================
// REQUISIÇÕES DA API (COMUNICAÇÃO GOOGLE APPS SCRIPT)
// ==========================================
async function api(dados) {
    dados.senha = SENHA_USUARIO;
    
    try {
        const res = await fetch(WEB_APP_URL, { 
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(dados) 
        });

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status} - ${res.statusText}`);
        }

        const json = await res.json();
        
        if (json.error) {
            throw new Error(json.error);
        }

        return json;
    } catch (err) {
        console.error("Erro na comunicação com o Google Apps Script:", err);
        throw err;
    }
}

async function fazerLogin() {
    const btn = document.getElementById('btnLogin');
    const inputSenhaEl = document.getElementById('input-senha');
    if (!inputSenhaEl) return;
    
    const senhaInput = inputSenhaEl.value;
    if (!senhaInput) return;
    
    if (btn) {
        btn.innerHTML = `<span>VALIDANDO...</span><span class="animate-spin text-lg">⏳</span>`;
        btn.disabled = true;
    }
    
    SENHA_USUARIO = senhaInput;

    try {
        const sucesso = await carregar();
        if (sucesso) {
            document.getElementById('login-screen')?.classList.add('hidden');
            document.getElementById('main-app')?.classList.remove('hidden');
            resetarTimerInatividade();
        } else { 
            alert("Senha incorreta ou erro de conexão."); 
            SENHA_USUARIO = ""; 
        }
    } catch (err) {
        console.error("Erro durante o login:", err);
        alert("Falha na conexão com o servidor. Verifique o console.");
        SENHA_USUARIO = "";
    } finally {
        if (btn) {
            btn.innerHTML = `<span>ENTRAR</span><span class="text-lg">→</span>`;
            btn.disabled = false;
        }
    }
}

async function carregar() {
    travarInterface(true);
    const btnReload = document.getElementById('btnReload');
    if (btnReload) btnReload.innerText = "⌛";

    try {
        const res = await api({ action: "buscar" });
        if (!res || !res.rows) return false;

        DADOS_BRUTOS = res.rows;
        
        if (res.stats) {
            const stBruto = document.getElementById('st-bruto');
            const stRec = document.getElementById('st-rec');
            const stRest = document.getElementById('st-rest');
            
            if (stBruto) stBruto.innerText = `R$ ${res.stats.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            if (stRec) stRec.innerText = `R$ ${res.stats.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            if (stRest) stRest.innerText = `R$ ${res.stats.restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }

        let totalLucro = DADOS_BRUTOS.reduce((acc, row) => acc + (limparValorParaEnvio(row[15]) || 0), 0);
        const stLucro = document.getElementById('st-lucro');
        if (stLucro) stLucro.innerText = `R$ ${totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        renderGraficoMensal(DADOS_BRUTOS);
        atualizarGraficoFiltro();
        renderTabela(DADOS_BRUTOS);
        renderLogs(DADOS_BRUTOS);
        return true;
    } catch (e) { 
        console.error("Erro no carregamento:", e);
        return false; 
    } finally {
        if (btnReload) btnReload.innerText = "🔄";
        travarInterface(false);
    }
}

// ==========================================
// RENDERING DA TABELA E LOGS
// ==========================================
function renderTabela(rows) {
    const buscaInput = document.getElementById('busca');
    const busca = buscaInput ? buscaInput.value.toLowerCase() : "";
    const lista = document.getElementById('lista');
    if (!lista) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let filtrados = rows.filter(r => {
        const saldo = limparValorParaEnvio(r[6]);
        const nome = (r[0] || "").toLowerCase();
        if (busca === "") return r[12] !== "Concluído" && saldo > 0;
        return nome.includes(busca);
    });

    filtrados.sort((a, b) => converterData(a[7]) - converterData(b[7]));

    lista.innerHTML = filtrados.map((row) => {
        const idxReal = row[row.length - 1];
        const dataVenc = converterData(row[7]);
        dataVenc.setHours(0, 0, 0, 0);

        const diffDias = Math.floor((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        let corData = "text-blue-400"; 
        let statusIcon = ""; 
        let rowClass = "";
        let badgeAtraso = "";

        if (row[12] !== "Concluído") {
            if (diffDias < 0) { 
                corData = "text-red-500 font-extrabold"; 
                statusIcon = "⚠️ "; 
                rowClass = "bg-red-950/20 border-l-4 border-l-red-500 atrasado-row"; 
                badgeAtraso = `<span class="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md font-bold uppercase ml-2">Atrasado (${Math.abs(diffDias)}d)</span>`;
            }
            else if (diffDias <= 3) { 
                corData = "text-orange-500 font-extrabold"; 
                statusIcon = "🕒 "; 
            }
        }

        const telefone = row[3] ? row[3].toString().replace(/\D/g, '') : '';
        const numLucro = limparValorParaEnvio(row[15]);
        const lucroVal = `R$ ${numLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        const nomeEsc = escapeHtml(row[0]);
        const telEsc = escapeHtml(row[3] || '');
        const itemEsc = escapeHtml(row[2] || '');
        const saldoEsc = escapeHtml(row[6] || '');
        const vencEsc = escapeHtml(row[7] || '');

        return `<tr class="${rowClass} border-b border-slate-800/50 hover:bg-slate-900/60 transition-colors">
            <td class="p-5 font-bold text-sm client-click cursor-pointer" onclick="abrirModalEditar(${idxReal})">
                <div class="text-blue-400 hover:underline flex flex-col items-start">
                    <div class="flex items-center">
                        <span class="font-extrabold text-base">${nomeEsc}</span>
                        ${badgeAtraso}
                    </div>
                    <span class="text-[10px] text-slate-500 font-normal">${telEsc}</span>
                </div>
            </td>
            <td class="p-5 text-xs text-slate-400">${itemEsc}</td>
            <td class="p-5 text-xs font-bold text-red-400">${saldoEsc}</td>
            <td class="p-5 text-xs font-black ${corData}">${statusIcon}${vencEsc}</td>
            <td class="p-5 text-xs font-black text-emerald-400">${escapeHtml(lucroVal)}</td>
            <td class="p-5 text-center flex items-center justify-center gap-2">
                <button onclick="abrirPag(${idxReal})" class="bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white hover:bg-blue-500 shadow-md transition-all active:scale-95">Receber</button>
                ${telefone ? `<button onclick="enviarWhatsApp('${nomeEsc.replace(/'/g, "\\'")}', '${telEsc.replace(/'/g, "\\'")}', '${saldoEsc.replace(/'/g, "\\'")}', '${vencEsc.replace(/'/g, "\\'")}', '${itemEsc.replace(/'/g, "\\'")}')" class="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 p-2 rounded-xl text-xs transition-all active:scale-95" title="Enviar Lembrete WhatsApp">💬</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function renderLogs(rows) {
    const buscaInput = document.getElementById('busca');
    const busca = buscaInput ? buscaInput.value.toLowerCase() : "";
    const container = document.getElementById('logList');
    if (!container) return;

    const clientesComLogs = rows.filter(r => (r[17] && r[17].toString().trim() !== "") || r[12] === "Concluído");

    container.innerHTML = clientesComLogs.slice().reverse().map(r => {
        const saldoNum = limparValorParaEnvio(r[6]);
        const isConcluido = r[12] === "Concluído" || saldoNum <= 0;

        const logRaw = r[17] || "";
        const itensLog = logRaw.split('|').map(p => p.trim()).filter(p => p.length > 0).reverse();
        if (busca !== "" && !(r[0] || "").toLowerCase().includes(busca)) return "";

        const idxReal = r[r.length - 1];

        return `<div class="bg-slate-900 p-5 rounded-3xl border border-slate-800 border-l-4 ${isConcluido ? 'border-l-emerald-500 shadow-lg shadow-emerald-950/20' : 'border-l-blue-600'}">
            <div class="flex justify-between items-start mb-4">
                <div class="truncate">
                    <h4 class="text-white font-black uppercase text-xs italic">${escapeHtml(r[0])}</h4>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">${escapeHtml(r[2])}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${isConcluido ? '<span class="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg font-black tracking-widest animate-pulse">QUITADO</span>' : ''}
                    <button onclick="gerarComprovante(${idxReal})" class="text-[9px] bg-slate-800 px-3 py-1 rounded-full font-bold hover:bg-slate-700 transition-colors">📄 Recibo</button>
                </div>
            </div>
            <div class="text-[11px] text-slate-400 font-mono bg-slate-950 p-4 rounded-2xl border border-slate-800/50 space-y-2 max-h-40 overflow-y-auto">
                ${itensLog.length > 0 ? itensLog.map((p, i) => `<div class="${i === 0 ? 'text-emerald-400 font-bold' : ''} py-1 border-b border-slate-800 last:border-0">${escapeHtml(p)}</div>`).join('') : '<div class="text-slate-600 italic">Sem registros</div>'}
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// COMUNICAÇÃO WHATSAPP
// ==========================================
function enviarWhatsApp(nome, telefone, saldo, vencimento, item) {
    let numLimpo = telefone.replace(/\D/g, '');
    if (!numLimpo.startsWith('55')) numLimpo = '55' + numLimpo;

    const mensagem = `Olá, *${nome}*! Tudo bem?\n\nPassando para lembrar sobre o pendente do *${item}* no valor de *${saldo}* com vencimento em *${vencimento}*.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Obrigado!`;
    const url = `https://api.whatsapp.com/send?phone=${numLimpo}&text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// ==========================================
// GRÁFICOS (CHART.JS)
// ==========================================
function renderGraficoMensal(rows) {
    const ctx = document.getElementById('graficoMensal');
    if (!ctx) return;
    
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const hoje = new Date();
    const mesesArray = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        mesesArray.push({ 
            mes: d.getMonth(), 
            ano: d.getFullYear(), 
            label: `${nomesMeses[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`, 
            faturamento: 0
        });
    }

    rows.forEach(row => {
        const log = row[17] || "";
        log.split('|').forEach(p => {
            const matchVal = p.match(/R\$\s?([\d,.]+)/i);
            const matchData = p.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
            if (matchVal && matchData) {
                const v = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                const mesLog = parseInt(matchData[2], 10) - 1;
                let anoLog = parseInt(matchData[3], 10);
                if (anoLog < 100) anoLog += 2000;

                mesesArray.forEach(m => { 
                    if (m.mes === mesLog && m.ano === anoLog) {
                        m.faturamento += v;
                    }
                });
            }
        });
    });

    if (meuGraficoMensal) meuGraficoMensal.destroy();

    meuGraficoMensal = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { 
            labels: mesesArray.map(m => m.label), 
            datasets: [{
                label: 'Recebido',
                data: mesesArray.map(m => m.faturamento),
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } }, 
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } 
            } 
        }
    });
}

function atualizarGraficoFiltro() {
    const ctx = document.getElementById('graficoFiltro');
    if (!ctx) return;

    const filtroAnoEl = document.getElementById('filtroAnoGrafico');
    const filtroMesEl = document.getElementById('filtroMesGrafico');
    
    const anoSelecionado = filtroAnoEl ? parseInt(filtroAnoEl.value, 10) : new Date().getFullYear();
    const mesSelecionado = filtroMesEl ? filtroMesEl.value : "TODOS";
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    let labels = [];
    let valores = [];

    if (mesSelecionado === "TODOS") {
        labels = nomesMeses;
        valores = new Array(12).fill(0);

        DADOS_BRUTOS.forEach(row => {
            const log = row[17] || "";
            log.split('|').forEach(p => {
                const matchVal = p.match(/R\$\s?([\d,.]+)/i);
                const matchData = p.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
                if (matchVal && matchData) {
                    const v = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                    const mesLog = parseInt(matchData[2], 10) - 1;
                    let anoLog = parseInt(matchData[3], 10);
                    if (anoLog < 100) anoLog += 2000;

                    if (anoLog === anoSelecionado) {
                        valores[mesLog] += v;
                    }
                }
            });
        });
    } else {
        const mesIdx = parseInt(mesSelecionado, 10);
        const diasNoMes = new Date(anoSelecionado, mesIdx + 1, 0).getDate();
        labels = Array.from({ length: diasNoMes }, (_, i) => `${i + 1}`);
        valores = new Array(diasNoMes).fill(0);

        DADOS_BRUTOS.forEach(row => {
            const log = row[17] || "";
            log.split('|').forEach(p => {
                const matchVal = p.match(/R\$\s?([\d,.]+)/i);
                const matchData = p.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
                if (matchVal && matchData) {
                    const v = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                    const diaLog = parseInt(matchData[1], 10);
                    const mesLog = parseInt(matchData[2], 10) - 1;
                    let anoLog = parseInt(matchData[3], 10);
                    if (anoLog < 100) anoLog += 2000;

                    if (anoLog === anoSelecionado && mesLog === mesIdx) {
                        if (diaLog >= 1 && diaLog <= diasNoMes) {
                            valores[diaLog - 1] += v;
                        }
                    }
                }
            });
        });
    }

    if (meuGraficoFiltro) meuGraficoFiltro.destroy();

    meuGraficoFiltro = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento',
                data: valores,
                backgroundColor: '#a855f7',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }
            }
        }
    });
}

// ==========================================
// MODAL: EDITAR CLIENTE
// ==========================================
function abrirModalEditar(idx) {
    if (bloqueado) return;
    const cliente = DADOS_BRUTOS.find(r => r[r.length - 1] === idx);
    if (!cliente) return;

    clienteEditandoIndex = idx;
    
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('edit_nome', cliente[0] || '');  
    setVal('edit_tel', cliente[3] || '');   
    setVal('edit_item', cliente[2] || '');  
    setVal('edit_valor', cliente[4] || ''); 
    
    const numLucro = limparValorParaEnvio(cliente[15]);
    const lucroFormatado = numLucro ? numLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    setVal('edit_lucro', lucroFormatado);
    
    setVal('edit_obs', cliente[11] || ''); 

    if (cliente[7]) { 
        const d = converterData(cliente[7]);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setVal('edit_data_pag', `${yyyy}-${mm}-${dd}`);
    } else {
        setVal('edit_data_pag', '');
    }

    document.getElementById('modalEditar')?.classList.remove('hidden');
}

function fecharEditar() {
    if (!bloqueado) document.getElementById('modalEditar')?.classList.add('hidden');
}

async function salvarEdicaoCliente() {
    if (bloqueado) return;
    const nomeVal = document.getElementById('edit_nome')?.value;
    if (!nomeVal) return alert("Preencha o Nome.");

    document.getElementById('modalEditar')?.classList.add('hidden');
    travarInterface(true);

    const valorNum = limparValorParaEnvio(document.getElementById('edit_valor')?.value);
    const lucroNum = limparValorParaEnvio(document.getElementById('edit_lucro')?.value);

    try {
        await api({
            action: "editar",
            indexPlanilha: Number(clienteEditandoIndex),
            nome: nomeVal,
            tel: document.getElementById('edit_tel')?.value || '',
            item: document.getElementById('edit_item')?.value || '',
            valor: valorNum,
            lucro: lucroNum,
            proximoVencimento: document.getElementById('edit_data_pag')?.value || '',
            obs: document.getElementById('edit_obs')?.value || ''
        });
        showToast("Cliente Atualizado!");
        await carregar();
    } catch (e) {
        showToast("Erro ao atualizar", true);
        await carregar();
    } finally {
        travarInterface(false);
    }
}

// ==========================================
// MODAL: PAGAMENTOS / RECEBIMENTOS
// ==========================================
function abrirPag(idx) {
    if (bloqueado) return;
    indexPlanilhaGlobal = idx;
    const item = DADOS_BRUTOS.find(r => r[r.length - 1] === idx);
    if (!item) return;

    const setText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setText('pagNome', item[0]);
    setText('pagInfoParcela', `VALOR DA PARCELA: ${item[8]}`);
    setText('pagRestante', `SALDO TOTAL: ${item[6]}`);
    
    saldoDevedorGlobal = item[6].toString().replace("R$", "").replace(/\s/g, "").trim();
    
    const vPagoEl = document.getElementById('vPago');
    if (vPagoEl) {
        vPagoEl.value = item[8].toString().replace("R$", "").replace(/\s/g, "").trim();
    }
    
    document.getElementById('modalPag')?.classList.remove('hidden');
}

function preencherValorTotal() {
    if (bloqueado) return;
    const vPagoEl = document.getElementById('vPago');
    if (vPagoEl) vPagoEl.value = saldoDevedorGlobal;
}

function fecharModalPag() { 
    if (!bloqueado) document.getElementById('modalPag')?.classList.add('hidden'); 
}

async function confirmarPagamento() {
    const valorInputEl = document.getElementById('vPago');
    if (!valorInputEl || bloqueado) return;
    
    const valorInput = valorInputEl.value;
    if (!valorInput) return;
    
    if (!confirm(`Deseja confirmar o recebimento de R$ ${valorInput}?`)) return;

    const valorParaAPI = limparValorParaEnvio(valorInput);
    document.getElementById('modalPag')?.classList.add('hidden');
    travarInterface(true);

    try {
        await api({ action: "pagar", indexPlanilha: indexPlanilhaGlobal, valorPago: valorParaAPI });
        showToast("Pagamento registrado!");
        await carregar();
    } catch (e) {
        showToast("Erro ao processar", true);
        await carregar();
    } finally {
        travarInterface(false);
    }
}

// ==========================================
// MODAL: NOVO CLIENTE
// ==========================================
function limparFormularioNovo() {
    const ids = ['n_nome', 'n_tel', 'n_item', 'n_valor', 'n_lucro', 'n_entrada', 'n_val_parc', 'n_obs'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selParc = document.getElementById('n_parc');
    if (selParc) selParc.value = '1';
}

function abrirNovo() { 
    if (!bloqueado) { 
        limparFormularioNovo();
        const dataPagEl = document.getElementById('n_data_pag');
        if (dataPagEl) dataPagEl.valueAsDate = new Date(); 
        document.getElementById('modalNovo')?.classList.remove('hidden'); 
    } 
}

function fecharNovo() { 
    if (!bloqueado) {
        document.getElementById('modalNovo')?.classList.add('hidden'); 
    }
}

async function salvarNovoCliente() {
    if (bloqueado) return;
    
    const nomeVal = document.getElementById('n_nome')?.value;
    const valorVal = document.getElementById('n_valor')?.value;
    const lucroInputVal = document.getElementById('n_lucro')?.value;
    
    if (!nomeVal || !valorVal) return alert("Preencha Nome e Valor.");
    if (!confirm("Confirmar cadastro do novo cliente?")) return;

    document.getElementById('modalNovo')?.classList.add('hidden');
    travarInterface(true);

    try {
        await api({
            action: "adicionar", 
            nome: nomeVal, 
            tel: document.getElementById('n_tel')?.value || '',
            item: document.getElementById('n_item')?.value || '', 
            valor: limparValorParaEnvio(valorVal),
            lucro: limparValorParaEnvio(lucroInputVal),
            entrada: limparValorParaEnvio(document.getElementById('n_entrada')?.value) || 0,
            valorParcela: limparValorParaEnvio(document.getElementById('n_val_parc')?.value) || 0,
            parcelas: document.getElementById('n_parc')?.value || '1', 
            dataPrimeiroPag: document.getElementById('n_data_pag')?.value || '',
            obs: document.getElementById('n_obs')?.value || ''
        });
        showToast("Cliente Cadastrado!");
        limparFormularioNovo();
        await carregar();
    } catch (e) {
        showToast("Erro ao cadastrar", true);
        await carregar();
    } finally {
        travarInterface(false);
    }
}

// ==========================================
// MODAL: COMPROVANTE / RECIBO
// ==========================================
function gerarComprovante(idx) {
    if (bloqueado) return;
    const d = DADOS_BRUTOS.find(r => r[r.length - 1] === idx);
    if (!d) return;

    const setText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setText('compNome', d[0]);
    setText('compItem', d[2]);
    setText('compRecebido', d[5]);
    setText('compRestante', d[6]);
    
    const logRaw = d[17] || "";
    const listEl = document.getElementById('compListaLogs');
    if (listEl) {
        listEl.innerHTML = logRaw.split('|')
            .reverse()
            .map(l => l.trim() ? `<div class="border-b border-slate-100 py-1 last:border-0">${escapeHtml(l.trim())}</div>` : '')
            .join('');
    }

    document.getElementById('modalComprovante')?.classList.remove('hidden');
}

function fecharComprovante() { 
    document.getElementById('modalComprovante')?.classList.add('hidden'); 
}

function imprimirComprovante() {
    window.print();
}

// ==========================================
// NAVEGAÇÃO E SESSÃO
// ==========================================
function switchTab(t) {
    if (bloqueado) return;
    const dash = document.getElementById('tab-dash');
    const logs = document.getElementById('tab-logs');
    
    if (dash) dash.classList.toggle('hidden', t !== 'dash');
    if (logs) logs.classList.toggle('hidden', t !== 'logs');
}

function filtrarTudo() { 
    renderTabela(DADOS_BRUTOS); 
    renderLogs(DADOS_BRUTOS); 
}

function fazerLogout() {
    if (bloqueado) return;
    SENHA_USUARIO = "";
    clearTimeout(tempoInatividade);

    const campoSenha = document.getElementById('input-senha');
    if (campoSenha) campoSenha.value = "";

    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('main-app')?.classList.add('hidden');
}
