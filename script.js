// Explorador do Multiverso — front-end
// Componente externo: Rick and Morty API (https://rickandmortyapi.com) —
// sem chave, uso livre, CORS liberado.
// Componente próprio: API "multiverso-api" (Flask), CRUD de favoritos + regra de negócio (episódios do personagem).

const API_BASE = window.MULTIVERSO_API_URL || "http://localhost:5000/api";

// Chave de demonstração para as rotas de escrita da API própria
const API_KEY = window.MULTIVERSO_API_KEY || "multiverso-mvp-2026";

const state = {
  page: 1,
  perPage: 6,
  totalPages: 1,
};

const el = (id) => document.getElementById(id);

function statusClasse(status) {
  return (
    {
      Alive: "alive",
      Dead: "dead",
    }[status] || "unknown"
  );
}

function statusLabel(status) {
  return (
    {
      Alive: "vivo",
      Dead: "morto",
    }[status] || "desconhecido"
  );
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

// NOTIFICAÇÕES TOAST
function showToast(mensagem, tipo = "info") {
  const container = el("toast-container");
  const toast = document.createElement("div");

  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3200);
}

// BUSCA NA API EXTERNA — RICK AND MORTY
el("search-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const nome = el("search-input").value.trim();
  const status = el("search-status");
  const grid = el("search-results");

  grid.innerHTML = "";

  if (!nome) {
    return;
  }

  status.textContent = "Buscando...";

  try {
    const resp = await fetch(
      `https://rickandmortyapi.com/api/character/?name=${encodeURIComponent(nome)}`,
    );

    if (resp.status === 404) {
      status.textContent = "Nenhum personagem encontrado.";
      return;
    }

    if (!resp.ok) {
      throw new Error("Falha na busca");
    }

    const data = await resp.json();

    status.textContent = `${data.info.count} resultado(s)`;

    data.results.slice(0, 9).forEach((personagem) => {
      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
        <img
          src="${personagem.image}"
          alt="${personagem.name}"
        >

        <h3>${personagem.name}</h3>

        <p class="meta">
          ${personagem.species} · ${statusLabel(personagem.status)}
        </p>

        <div class="card-actions">
          <button class="add-btn">
            Favoritar
          </button>
        </div>
      `;

      card.querySelector(".add-btn").addEventListener("click", () =>
        addToList({
          character_id: personagem.id,
          character_name: personagem.name,
          status: personagem.status,
          species: personagem.species,
          image_url: personagem.image,
        }),
      );

      grid.appendChild(card);
    });
  } catch (err) {
    status.textContent =
      "Não foi possível consultar a Rick and Morty API agora.";
  }
});

// ADICIONAR AOS FAVORITOS
async function addToList(payload) {
  try {
    const resp = await fetch(`${API_BASE}/favoritos`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        ...payload,
        notas: "",
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));

      throw new Error(err.erro || "Falha ao favoritar");
    }

    showToast(`${payload.character_name} adicionado aos favoritos.`, "success");

    state.page = 1;

    loadList();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// FAVORITOS — CARREGAR LISTA
async function loadList() {
  const status = el("list-status");
  const grid = el("list-results");

  const filtroStatus = el("filter-status").value;

  const species = el("filter-species").value.trim();

  const sort = el("sort-by").value;

  const params = new URLSearchParams({
    page: state.page,
    per_page: state.perPage,
    sort: sort,
  });

  if (filtroStatus) {
    params.set("status", filtroStatus);
  }

  if (species) {
    params.set("species", species);
  }

  status.textContent = "Carregando...";

  try {
    const resp = await fetch(`${API_BASE}/favoritos?${params.toString()}`);

    if (!resp.ok) {
      throw new Error("Erro ao carregar a lista");
    }

    const data = await resp.json();

    state.totalPages = Math.max(1, Math.ceil(data.total / state.perPage));

    el("page-info").textContent = `página ${state.page} de ${state.totalPages}`;

    el("prev-page").disabled = state.page <= 1;

    el("next-page").disabled = state.page >= state.totalPages;

    grid.innerHTML = "";

    status.textContent =
      data.total === 0 ? "Você ainda não favoritou ninguém." : "";

    data.itens.forEach((item) => {
      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
        <img
          src="${item.image_url || ""}"
          alt="${item.character_name}"
        >

        <h3>${item.character_name}</h3>

        <p class="meta">
          ${item.species || "—"}
        </p>

        <span class="stamp ${statusClasse(item.status)}">
          ${statusLabel(item.status)}
        </span>

        ${item.notas ? `<p class="notes">${item.notas}</p>` : ""}

        <div class="card-actions">
          <button class="notas-btn">
            Notas
          </button>

          <button class="episodios-btn">
            Episódios
          </button>

          <button class="del-btn">
            Remover
          </button>
        </div>
      `;

      card
        .querySelector(".notas-btn")
        .addEventListener("click", () => openNotas(item));

      card
        .querySelector(".episodios-btn")
        .addEventListener("click", () => openEpisodios(item));

      card
        .querySelector(".del-btn")
        .addEventListener("click", () => removeItem(item.id));

      grid.appendChild(card);
    });
  } catch (err) {
    status.textContent = "Não foi possível falar com a API. Ela está rodando?";
  }

  loadStats();
}

// RESUMO DE FAVORITOS
async function loadStats() {
  const box = el("stats-box");

  if (!box) {
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/favoritos/estatisticas`);

    if (!resp.ok) {
      throw new Error();
    }

    const { total, por_status } = await resp.json();

    box.innerHTML = renderResumo(total, por_status);
  } catch {
    box.innerHTML = `<span>Resumo indisponível agora.</span>`;
  }
}

function renderResumo(total, porStatus) {
  const cores = {
    Alive: "#97ce4c",
    Dead: "#d9704f",
    unknown: "#6b7684",
  };

  const labels = {
    Alive: "Vivos",
    Dead: "Mortos",
    unknown: "Desconhecidos",
  };

  const itens = Object.entries(porStatus)
    .map(
      ([chave, valor]) =>
        `
          <span class="stat-item">
            <span
              class="dot"
              style="background:${cores[chave]}"
            ></span>
            ${labels[chave]}: ${valor}
          </span>
          `,
    )
    .join("");

  return `
    <strong>
      Resumo de Favoritos:
    </strong>

    Total ${total}

    ${itens}
  `;
}

// REMOVER FAVORITO
async function removeItem(id) {
  if (!confirm("Remover este personagem dos favoritos?")) {
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/favoritos/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!resp.ok) {
      throw new Error("Falha ao remover");
    }

    showToast("Removido dos favoritos.", "info");

    loadList();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// NOTAS E EPISÓDIOS
let editingId = null;

// ABRIR NOTAS
function openNotas(item) {
  editingId = item.id;

  const dialog = el("edit-dialog");

  const notasBox = el("notas-box");

  const episodiosBox = el("episodios-box");

  // Título
  el("dialog-title").textContent = `Notas — ${item.character_name}`;

  // MOSTRA NOTAS
  notasBox.classList.remove("hidden");
  notasBox.style.display = "block";

  // ESCONDE EPISÓDIOS
  episodiosBox.classList.add("hidden");
  episodiosBox.style.display = "none";

  // Preenche o campo
  el("edit-notas").value = item.notas || "";

  // Abre o modal
  dialog.classList.remove("hidden");
  dialog.style.display = "flex";
}

// ABRIR EPISÓDIOS
function openEpisodios(item) {
  editingId = item.id;

  const dialog = el("edit-dialog");

  const notasBox = el("notas-box");

  const episodiosBox = el("episodios-box");

  // Título
  el("dialog-title").textContent = `Episódios — ${item.character_name}`;

  // ESCONDE COMPLETAMENTE AS NOTAS
  notasBox.classList.add("hidden");
  notasBox.style.display = "none";

  // MOSTRA SOMENTE OS EPISÓDIOS
  episodiosBox.classList.remove("hidden");
  episodiosBox.style.display = "block";

  // Abre o modal
  dialog.classList.remove("hidden");
  dialog.style.display = "flex";

  // Busca os episódios
  carregarEpisodios();
}

// CARREGAR EPISÓDIOS
async function carregarEpisodios() {
  const lista = el("episodios-list");

  lista.innerHTML = "Carregando episódios...";

  try {
    const resp = await fetch(`${API_BASE}/favoritos/${editingId}/episodios`);

    if (!resp.ok) {
      throw new Error();
    }

    const data = await resp.json();

    if (data.episodios && data.episodios.length) {
      lista.innerHTML = `
        <ul>
          ${data.episodios
            .map(
              (e) => `
                <li>
                  <strong>
                    ${e.codigo}
                  </strong>
                  —
                  ${e.nome}
                  (${e.data_exibicao})
                </li>
              `,
            )
            .join("")}
        </ul>
      `;
    } else {
      lista.innerHTML = "Nenhum episódio encontrado.";
    }
  } catch {
    lista.innerHTML = "Não foi possível buscar os episódios agora.";
  }
}

// FECHAR MODAL — NOTAS
el("edit-cancel").addEventListener("click", () => {
  fecharDialog();
});

// FECHAR MODAL — EPISÓDIOS
el("episodios-close").addEventListener("click", () => {
  fecharDialog();
});

// FUNÇÃO CENTRAL PARA FECHAR O MODAL
function fecharDialog() {
  const dialog = el("edit-dialog");

  const notasBox = el("notas-box");

  const episodiosBox = el("episodios-box");

  // Fecha o modal
  dialog.classList.add("hidden");
  dialog.style.display = "none";

  // Limpa os estados para a próxima abertura
  notasBox.classList.add("hidden");
  notasBox.style.display = "none";

  episodiosBox.classList.add("hidden");
  episodiosBox.style.display = "none";
}

// SALVAR NOTAS
el("edit-save").addEventListener("click", async () => {
  try {
    const resp = await fetch(`${API_BASE}/favoritos/${editingId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        notas: el("edit-notas").value,
      }),
    });

    if (!resp.ok) {
      throw new Error("Falha ao salvar notas");
    }

    showToast("Notas salvas.", "success");

    fecharDialog();

    loadList();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// FILTROS
el("filter-status").addEventListener("change", () => {
  state.page = 1;
  loadList();
});

el("filter-species").addEventListener("input", () => {
  state.page = 1;
  loadList();
});

el("sort-by").addEventListener("change", () => {
  state.page = 1;
  loadList();
});

// PAGINAÇÃO
el("prev-page").addEventListener("click", () => {
  if (state.page > 1) {
    state.page--;
    loadList();
  }
});

el("next-page").addEventListener("click", () => {
  if (state.page < state.totalPages) {
    state.page++;
    loadList();
  }
});

// INICIALIZAÇÃO
loadList();
