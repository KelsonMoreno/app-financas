const form = document.getElementById("finance-form");
const tipo = document.getElementById("tipo");
const valor = document.getElementById("valor");
const mes = document.getElementById("mes");
const descricao = document.getElementById("descricao");
const meta = document.getElementById("meta");
const vencimento = document.getElementById("vencimento");
const grupoMeta = document.getElementById("grupo-meta");
const grupoVencimento = document.getElementById("grupo-vencimento");

const resumo = document.getElementById("resumo");
const historico = document.getElementById("historico");
const filtroMes = document.getElementById("filtroMes");

let dados = JSON.parse(localStorage.getItem("financeiros")) || [];

tipo.addEventListener("change", () => {
  if (tipo.value === "divida") {
    grupoMeta.style.display = "block";
    grupoVencimento.style.display = "block";
  } else {
    grupoMeta.style.display = "none";
    grupoVencimento.style.display = "none";
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const novoDado = {
    tipo: tipo.value,
    valor: parseFloat(valor.value),
    mes: mes.value,
    descricao: descricao.value,
    meta: meta.value ? parseFloat(meta.value) : null,
    vencimento: vencimento.value || null,
    id: Date.now()
  };

  const editando = form.getAttribute("data-editando");
  if (editando) {
    const index = dados.findIndex(d => d.id == editando);
    if (index !== -1) {
      dados[index] = { ...novoDado, id: dados[index].id };
    }
    form.removeAttribute("data-editando");
  } else {
    dados.push(novoDado);
  }

  localStorage.setItem("financeiros", JSON.stringify(dados));
  form.reset();
  tipo.dispatchEvent(new Event("change"));
  atualizarInterface();
});

filtroMes.addEventListener("change", atualizarInterface);

function atualizarInterface() {
  const mesSelecionado = filtroMes.value;
  const dadosFiltrados = mesSelecionado
    ? dados.filter(d => d.mes === mesSelecionado)
    : dados;

  atualizarResumo(dadosFiltrados);
  atualizarHistorico(dadosFiltrados);
  atualizarGrafico(dadosFiltrados);
}

function atualizarResumo(lista) {
  const totalSalario = lista.filter(d => d.tipo === "salario").reduce((s, d) => s + d.valor, 0);
  const totalDivida = lista.filter(d => d.tipo === "divida").reduce((s, d) => s + d.valor, 0);
  const saldo = totalSalario - totalDivida;

  resumo.innerHTML = `
    <p><strong>Total Salários:</strong> R$ ${totalSalario.toFixed(2)}</p>
    <p><strong>Total Dívidas:</strong> R$ ${totalDivida.toFixed(2)}</p>
    <p><strong>Saldo:</strong> <span style="color:${saldo < 0 ? 'red' : 'green'}">R$ ${saldo.toFixed(2)}</span></p>
  `;
}

function atualizarHistorico(lista) {
  historico.innerHTML = "";

  lista.forEach(dado => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${dado.tipo === "salario" ? "Salário" : "Dívida"}:</strong> ${dado.descricao}<br>
      Valor: R$ ${dado.valor.toFixed(2)}<br>
      Mês: ${dado.mes}<br>
      ${dado.tipo === "divida" && dado.meta !== null ? "Meta: R$ " + dado.meta.toFixed(2) + "<br>" : ""}
      ${dado.tipo === "divida" && dado.meta !== null ? `<span style="color:${dado.valor > dado.meta ? 'red' : 'green'}">Status: ${dado.valor > dado.meta ? 'Acima da Meta' : 'Dentro da Meta'}</span><br>` : ""}
      ${dado.vencimento ? "Vencimento: " + dado.vencimento + "<br>" : ""}
      <button class="acao-btn editar-btn" onclick="editarDado(${dado.id})">Editar</button>
      <button class="acao-btn remover-btn" onclick="removerDado(${dado.id})">Remover</button>
    `;
    historico.appendChild(div);
  });
}

function editarDado(id) {
  const dado = dados.find(d => d.id === id);
  if (dado) {
    tipo.value = dado.tipo;
    valor.value = dado.valor;
    mes.value = dado.mes;
    descricao.value = dado.descricao;
    meta.value = dado.meta || "";
    vencimento.value = dado.vencimento || "";

    tipo.dispatchEvent(new Event("change"));
    form.setAttribute("data-editando", id);
  }
}

function removerDado(id) {
  if (confirm("Deseja remover este lançamento?")) {
    dados = dados.filter(d => d.id !== id);
    localStorage.setItem("financeiros", JSON.stringify(dados));
    atualizarInterface();
  }
}

let grafico;
function atualizarGrafico(lista) {
  const meses = [...new Set(lista.map(d => d.mes))].sort();
  const salarios = meses.map(m => lista.filter(d => d.tipo === "salario" && d.mes === m).reduce((s, d) => s + d.valor, 0));
  const dividas = meses.map(m => lista.filter(d => d.tipo === "divida" && d.mes === m).reduce((s, d) => s + d.valor, 0));

  const ctx = document.getElementById("graficoFinanceiro").getContext("2d");
  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        {
          label: "Salários",
          data: salarios,
          backgroundColor: "#00b894"
        },
        {
          label: "Dívidas",
          data: dividas,
          backgroundColor: "#d63031"
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

atualizarInterface();

// --- Notificações de Vencimento ---
function solicitarPermissaoNotificacao() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

function verificarVencimentos() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);

  dados.forEach(dado => {
    if (dado.tipo === "divida" && dado.vencimento) {
      const dataVenc = new Date(dado.vencimento);
      if (
        dataVenc.getFullYear() === amanha.getFullYear() &&
        dataVenc.getMonth() === amanha.getMonth() &&
        dataVenc.getDate() === amanha.getDate()
      ) {
        new Notification("Lembrete de Vencimento", {
          body: `Sua dívida "${dado.descricao}" vence amanhã!`,
          icon: "icons/icon-192.png"
        });
      }
    }
  });
}

// Solicita permissão e verifica vencimentos
solicitarPermissaoNotificacao();
verificarVencimentos();

