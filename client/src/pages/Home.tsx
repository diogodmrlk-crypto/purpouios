import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

const PROFILE_PATH = "/purpouios.mobileconfig";
const API_URL = "https://69b9908ce69653ffe6a81689.mockapi.io/api/v1/Scy";
const ADMIN_KEY = import.meta.env.VITEPURPOUADMIN?.trim() ?? "";
const USER_SESSION_KEY = "purpouios.user.key";
const USER_DEVICE_KEY = "purpouios.device.id";

type View = "login" | "panel" | "admin";
type AdminPage = "overview" | "keys";
type KeyRecord = {
  id?: string;
  key?: string;
  code?: string;
  token?: string;
  username?: string;
  user?: string;
  used?: boolean;
  device?: string | null;
  hwid?: string | null;
  expire?: number;
  type?: string;
  status?: string;
  active?: boolean;
  expiresAt?: string | number | null;
  createdAt?: string | number;
  activatedAt?: string | number | null;
  onlineAt?: string | number | null;
  history?: unknown[];
};

const progressCopy = [
  { max: 30, label: "Conectando...", message: "Conectando ao servidor..." },
  { max: 65, label: "Baixando DNS...", message: "Baixando perfil de configuração..." },
  { max: 90, label: "Preparando...", message: "Preparando instalação..." },
  { max: 100, label: "Finalizando...", message: "Quase pronto..." },
];

function getRecordKey(record: KeyRecord) { return record.key ?? record.code ?? record.token ?? ""; }
function getDevice(record: KeyRecord) { return record.hwid ?? record.device ?? null; }
function getProgressCopy(value: number) { return progressCopy.find((item) => value < item.max) ?? progressCopy[progressCopy.length - 1]; }
function isActive(record: KeyRecord) { return record.active !== false && !["inactive", "disabled", "expired", "revoked"].includes(record.status?.toLowerCase() ?? ""); }
function timestampLabel(value?: string | number | null) {
  if (!value) return "—";
  const milliseconds = typeof value === "number" ? (value < 1_000_000_000_000 ? value * 1000 : value) : new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(milliseconds));
}
function generatePermanentKey() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return `PURPOUIOS-perm-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}
function getDeviceId() {
  const saved = window.localStorage.getItem(USER_DEVICE_KEY);
  if (saved) return saved;
  const generated = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_DEVICE_KEY, generated);
  return generated;
}
function getOperatingSystem() {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("iphone") || platform.includes("ipad") || /iphone|ipad/i.test(navigator.userAgent)) return "ios";
  if (platform.includes("android")) return "android";
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  return "browser";
}
function getDeviceName() {
  if (/iphone/i.test(navigator.userAgent)) return "iPhone";
  if (/ipad/i.test(navigator.userAgent)) return "iPad";
  return navigator.platform || "Browser";
}

export default function Home() {
  const [view, setView] = useState<View>("login");
  const [adminPage, setAdminPage] = useState<AdminPage>("overview");
  const [access, setAccess] = useState("");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [search, setSearch] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => () => { if (intervalRef.current !== null) window.clearInterval(intervalRef.current); }, []);

  useEffect(() => {
    const savedKey = window.localStorage.getItem(USER_SESSION_KEY);
    if (!savedKey) { setIsRestoringSession(false); return; }
    void (async () => {
      try {
        const response = await fetch(API_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("api");
        const records = (await response.json()) as KeyRecord[];
        const matched = records.find((record) => getRecordKey(record).toLowerCase() === savedKey.toLowerCase() && isActive(record));
        if (matched) { await syncKeyUsage(matched, false); setAccess(savedKey); setView("panel"); startPreparation(); }
        else window.localStorage.removeItem(USER_SESSION_KEY);
      } catch {
        // Keep the saved session while the API is temporarily unavailable.
        setAccess(savedKey); setView("panel"); startPreparation();
      } finally { setIsRestoringSession(false); }
    })();
  }, []);

  useEffect(() => {
    if (view !== "panel" || !access) return;
    const heartbeat = async () => {
      try {
        const response = await fetch(API_URL, { cache: "no-store" });
        if (!response.ok) return;
        const records = (await response.json()) as KeyRecord[];
        const matched = records.find((record) => getRecordKey(record).toLowerCase() === access.toLowerCase() && isActive(record));
        if (matched) await syncKeyUsage(matched, false);
      } catch {
        // Keep the local session if the API is temporarily unavailable.
      }
    };
    const interval = window.setInterval(() => void heartbeat(), 60_000);
    return () => window.clearInterval(interval);
  }, [access, view]);

  const loadKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("api");
      const records = (await response.json()) as KeyRecord[];
      setKeys([...records].reverse());
    } catch {
      setError("Não foi possível carregar as keys da MockAPI.");
    } finally { setIsLoadingKeys(false); }
  };

  const startPreparation = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    setProgress(0); setIsReady(false); setIsActivated(false);
    let nextProgress = 0;
    intervalRef.current = window.setInterval(() => {
      nextProgress += 1; setProgress(nextProgress);
      if (nextProgress >= 100) { if (intervalRef.current !== null) window.clearInterval(intervalRef.current); intervalRef.current = null; setIsReady(true); }
    }, 25);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = access.trim(); setError(""); setNotice("");
    if (!value) { setError(isAdminLogin ? "Digite a chave administrativa." : "Digite sua key de acesso."); return; }
    if (isAdminLogin) {
      if (!ADMIN_KEY) { setError("Admin desativado. Configure VITEPURPOUADMIN na Vercel."); return; }
      if (value !== ADMIN_KEY) { setError("Chave administrativa inválida."); return; }
      setView("admin"); setAdminPage("overview"); await loadKeys(); return;
    }
    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("api");
      const records = (await response.json()) as KeyRecord[];
      const matched = records.find((record) => getRecordKey(record).toLowerCase() === value.toLowerCase() && isActive(record));
      if (!matched) { setError("Key inválida, expirada ou desativada."); return; }
      await syncKeyUsage(matched, true);
      window.localStorage.setItem(USER_SESSION_KEY, value);
      setView("panel"); startPreparation();
    } catch { setError("Não foi possível consultar as keys agora. Tente novamente."); }
  };

  async function syncKeyUsage(record: KeyRecord, addHistory: boolean) {
    if (!record.id) return;
    const now = Math.floor(Date.now() / 1000);
    const deviceId = getDeviceId();
    const history = Array.isArray(record.history) ? record.history : [];
    const nextHistory = addHistory
      ? [...history, { id: Date.now(), operatingSystem: getOperatingSystem(), device: getDeviceName(), performance: "standard", createdAt: new Date().toISOString() }].slice(-30)
      : history;
    const response = await fetch(`${API_URL}/${record.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ used: true, device: deviceId, hwid: deviceId, activatedAt: record.activatedAt ?? now, onlineAt: now, status: "active", active: true, history: nextHistory }),
    });
    if (!response.ok) throw new Error("sync-key");
  }

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingKey(true); setError(""); setNotice("");
    const key = generatePermanentKey();
    const createdAt = Math.floor(Date.now() / 1000);
    try {
      const response = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, username: username.trim() || "sem-nome", used: false, device: null, hwid: null, expire: 0, type: "permanent", createdAt, activatedAt: null, expiresAt: null, status: "active", active: true, onlineAt: null, history: [] }),
      });
      if (!response.ok) throw new Error("create");
      setUsername(""); setIsCreateOpen(false); setNotice(`Key ${key} criada e salva na MockAPI.`); await loadKeys();
    } catch { setError("Não foi possível criar a key na MockAPI."); }
    finally { setIsSavingKey(false); }
  };

  const updateKey = async (record: KeyRecord, patch: Partial<KeyRecord>, message: string) => {
    if (!record.id) return;
    setError(""); setNotice("");
    try {
      const response = await fetch(`${API_URL}/${record.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error("update");
      setNotice(message); await loadKeys();
    } catch { setError("Não foi possível atualizar essa key na MockAPI."); }
  };

  const deleteKey = async (record: KeyRecord) => {
    if (!record.id || !window.confirm(`Excluir a key ${getRecordKey(record)} da MockAPI?`)) return;
    try {
      const response = await fetch(`${API_URL}/${record.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete");
      setNotice("Key excluída da MockAPI."); await loadKeys();
    } catch { setError("Não foi possível excluir essa key."); }
  };

  const resetKey = (record: KeyRecord) => updateKey(record, { used: false, device: null, hwid: null, activatedAt: null, onlineAt: null, status: "active", active: true }, "Vínculo da key reiniciado.");
  const toggleKey = (record: KeyRecord) => isActive(record) ? updateKey(record, { status: "revoked", active: false }, "Key bloqueada.") : updateKey(record, { status: "active", active: true }, "Key reativada.");
  const logout = () => { setView("login"); setAccess(""); setError(""); setNotice(""); setIsDrawerOpen(false); setIsUserMenuOpen(false); setIsLogoutConfirmOpen(false); };
  const requestUserLogout = () => { setIsUserMenuOpen(false); setIsLogoutConfirmOpen(true); };
  const confirmUserLogout = () => { window.localStorage.removeItem(USER_SESSION_KEY); logout(); };
  const downloadProfile = () => {
    // Do not use the download attribute: iOS needs to receive the profile
    // with Apple's MIME type so Safari can hand it to the Settings installer.
    window.location.assign(PROFILE_PATH);
    setIsActivated(true);
  };

  const filteredKeys = useMemo(() => keys.filter((record) => `${getRecordKey(record)} ${record.username ?? record.user ?? ""} ${getDevice(record) ?? ""}`.toLowerCase().includes(search.toLowerCase())), [keys, search]);
  const activeCount = keys.filter(isActive).length;
  const revokedCount = keys.filter((record) => !isActive(record)).length;
  const linkedCount = keys.filter((record) => Boolean(getDevice(record))).length;

  if (isRestoringSession) return <main className="app-shell session-loading"><div className="session-spinner" aria-label="Restaurando sessão" /><span>Restaurando seu acesso...</span></main>;

  if (view === "admin") {
    return <main className="app-shell admin-shell"><div className="ambient ambient-left" aria-hidden="true" /><div className="ambient ambient-right" aria-hidden="true" /><div className="grain" aria-hidden="true" />
      <div className={`admin-layout ${isDrawerOpen ? "drawer-open" : ""}`}>
        <aside className="admin-sidebar">
          <div className="sidebar-brand"><div className="mini-logo">🩸</div><div><strong>PURPOU DEV</strong><span>Admin panel</span></div></div>
          <nav><p className="nav-label">GERENCIAMENTO</p><button className={adminPage === "overview" ? "nav-item active" : "nav-item"} onClick={() => { setAdminPage("overview"); setIsDrawerOpen(false); }}>◉ <span>Visão geral</span></button><button className={adminPage === "keys" ? "nav-item active" : "nav-item"} onClick={() => { setAdminPage("keys"); setIsDrawerOpen(false); }}>⌁ <span>Chaves</span><b>{keys.length}</b></button><button className="nav-item" onClick={() => setNotice("Configurações disponíveis em breve.")}>⚙ <span>Config</span></button></nav>
          <button className="sidebar-logout" onClick={logout}>↩ <span>Sair do painel</span></button>
        </aside>
        <div className="admin-main">
          <header className="admin-header"><button className="menu-button" onClick={() => setIsDrawerOpen((current) => !current)}>☰</button><div><span className="header-kicker">PURPOU IOS · ADMIN</span><strong>{adminPage === "overview" ? "Visão geral" : "Gestão de acessos"}</strong></div><button className="header-refresh" onClick={() => void loadKeys()} disabled={isLoadingKeys}>↻</button></header>
          <section className="admin-content">
            {adminPage === "overview" ? <>
              <div className="hero-copy"><span className="section-kicker">VISÃO GERAL</span><h1>Seu painel de controle.</h1><p>Gerencie licenças, usuários e dispositivos vinculados ao PurpouIOS.</p><button className="create-access-button" onClick={() => setIsCreateOpen(true)}>⌁ <span>Criar acesso</span></button></div>
              <div className="metric-grid"><MetricCard icon="♙" tone="pink" label="Total de usuários" value={keys.length} caption="acessos criados" /><MetricCard icon="✓" tone="green" label="Licenças ativas" value={activeCount} caption="em funcionamento" /><MetricCard icon="⊘" tone="blue" label="Chaves revogadas" value={revokedCount} caption="não podem acessar" /><MetricCard icon="▣" tone="purple" label="Dispositivos vinculados" value={linkedCount} caption="últimos acessos" /></div>
              <ActivitySection keys={keys} onOpen={() => setAdminPage("keys")} />
            </> : <>
              <div className="page-title-row"><div><span className="section-kicker">GESTÃO DE ACESSOS</span><h1>Licenças & usuários.</h1><p>Keys permanentes salvas na sua MockAPI.</p></div><button className="create-access-button" onClick={() => setIsCreateOpen(true)}>+ <span>Novo acesso</span></button></div>
              <div className="search-row"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por usuário, HWID ou chave..." /><button onClick={() => void loadKeys()}>Atualizar</button></div>
              {error && <p className="admin-message error-message">{error}</p>}{notice && <p className="admin-message success-message">{notice}</p>}
              <div className="license-list">{isLoadingKeys ? <div className="empty-state">Consultando MockAPI...</div> : filteredKeys.length === 0 ? <div className="empty-state">Nenhuma key encontrada. Crie um novo acesso.</div> : filteredKeys.map((record) => <LicenseCard key={record.id ?? getRecordKey(record)} record={record} onReset={() => void resetKey(record)} onToggle={() => void toggleKey(record)} onDelete={() => void deleteKey(record)} />)}</div>
            </>}
            {adminPage === "overview" && (error || notice) && <div className="admin-message-stack">{error && <p className="admin-message error-message">{error}</p>}{notice && <p className="admin-message success-message">{notice}</p>}</div>}
          </section>
        </div>
      </div>
      {isCreateOpen && <div className="modal-backdrop" onClick={() => setIsCreateOpen(false)}><div className="create-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setIsCreateOpen(false)}>×</button><span className="section-kicker">NOVO ACESSO</span><h2>Criar uma licença.</h2><p>Gere uma key permanente e salve todos os dados diretamente na MockAPI.</p><form onSubmit={createKey}><label htmlFor="username">Nome do usuário</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex: player_pro" autoFocus /><label>Plano</label><div className="plan-choice"><strong>♾ Permanente</strong><span>Acesso sem expiração</span></div><div className="modal-note">A key será criada como <b>PURPOUIOS-perm-XXXXXXXXX</b> e ficará salva na API mesmo após sair ou atualizar.</div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsCreateOpen(false)}>Cancelar</button><button type="submit" className="create-access-button" disabled={isSavingKey}>{isSavingKey ? "Criando..." : "Criar e gerar key"}</button></div></form></div></div>}
    </main>;
  }

  if (view === "login") return <main className="app-shell"><div className="ambient ambient-left" aria-hidden="true" /><div className="ambient ambient-right" aria-hidden="true" /><div className="grain" aria-hidden="true" /><div className="container"><section className="card login-card" aria-labelledby="login-title"><div className="logo logo-blood" aria-hidden="true">🩸</div><p className="eyebrow">CONFIGURAÇÃO PRIVADA · IOS</p><h1 id="login-title">PurpouIOS</h1><p className="subtitle">{isAdminLogin ? "Acesso administrativo" : "Acesso ao painel iOS"}</p><form onSubmit={handleLogin} noValidate><div className="input-box"><label className="sr-only" htmlFor="usuario">Acesso</label><input id="usuario" type="text" value={access} onChange={(event) => { setAccess(event.target.value); if (error) setError(""); }} placeholder={isAdminLogin ? "Digite a chave admin" : "Digite sua key de acesso"} autoComplete="off" autoCapitalize="none" spellCheck="false" inputMode="text" enterKeyHint="go" autoFocus /></div><button className="primary-button" type="submit"><span>Entrar</span><span className="button-arrow" aria-hidden="true">↗</span></button></form><p className={`error ${error ? "is-visible" : ""}`} role="alert">{error || " "}</p><button className="admin-link" type="button" onClick={() => { setIsAdminLogin((current) => !current); setAccess(""); setError(""); }}>{isAdminLogin ? "Voltar para acesso por key" : "Acesso administrativo"}</button><div className="footer"><span className="footer-dot" aria-hidden="true" /> PurpouIOS <span>•</span> Sistema iOS</div></section></div></main>;

  const copy = getProgressCopy(progress);
  return <main className="app-shell user-panel-shell"><div className="user-topbar"><div className="user-brand"><span className="user-brand-dot" /> PURPOU IOS</div><div className="user-menu-wrap"><button className="user-menu-button" type="button" aria-label="Abrir menu" aria-expanded={isUserMenuOpen} onClick={() => setIsUserMenuOpen((current) => !current)}><span /><span /><span /></button>{isUserMenuOpen && <div className="user-menu"><button type="button" onClick={requestUserLogout}>↩ Sair do acesso</button></div>}</div></div><div className="container"><section className="card panel-card" aria-labelledby="panel-title"><div className="panel-header"><div className="logo logo-settings" aria-hidden="true">⚙️</div><div><p className="eyebrow">PURPOU IOS · PERFIL 01</p><h2 id="panel-title">Abaixar DNS</h2></div></div><p className="panel-description">Prepare o perfil de configuração para seu dispositivo.</p><div className="progress-area" aria-live="polite"><div className="progress-info"><span>{isReady ? "Concluído" : copy.label}</span><span>{progress}%</span></div><div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span className="live-indicator" aria-hidden="true" /><span>{isReady ? "Perfil validado" : "Conexão segura"}</span></div></div><p className={`status ${isReady ? "status-ready" : ""}`}>{isReady ? (isActivated ? "Perfil aberto. Siga as instruções do iOS para instalar." : "Perfil pronto. Toque em Ativar para continuar.") : copy.message}</p><button className={`primary-button activate-button ${isReady ? "is-visible" : ""}`} type="button" onClick={downloadProfile} disabled={!isReady}><span>{isActivated ? "Abrir novamente" : "Ativar"}</span><span className="button-arrow" aria-hidden="true">↓</span></button><div className="footer"><span className="footer-dot" aria-hidden="true" /> PURPOU IOS <span>•</span> Perfil de configuração</div></section></div>{isLogoutConfirmOpen && <div className="modal-backdrop" onClick={() => setIsLogoutConfirmOpen(false)}><div className="logout-modal" onClick={(event) => event.stopPropagation()}><div className="logout-icon">!</div><h2>Sair do acesso?</h2><p>Se você sair, será necessário inserir sua key novamente para acessar este painel.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsLogoutConfirmOpen(false)}>Cancelar</button><button type="button" className="create-access-button logout-confirm-button" onClick={confirmUserLogout}>Sim, sair</button></div></div></div>}</main>;
}

function MetricCard({ icon, tone, label, value, caption }: { icon: string; tone: string; label: string; value: number; caption: string }) { return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-caption">{caption}</span></div>; }
function ActivitySection({ keys, onOpen }: { keys: KeyRecord[]; onOpen: () => void }) { const latest = keys.slice(0, 3); return <div className="activity-section"><div className="activity-heading"><div><span className="section-kicker">ATIVIDADE</span><h2>Últimos acessos</h2></div><button onClick={onOpen}>Ver todos ›</button></div><div className="activity-list">{latest.length === 0 ? <div className="empty-state">Nenhuma atividade registrada.</div> : latest.map((record) => <div className="activity-row" key={record.id ?? getRecordKey(record)}><span className={`activity-status ${isActive(record) ? "active" : "revoked"}`} /><div><strong>{getRecordKey(record)}</strong><span>{record.username ?? record.user ?? "sem usuário"}</span></div><small>{isActive(record) ? "Ativa" : "Revogada"}</small></div>)}</div></div>; }
function LicenseCard({ record, onReset, onToggle, onDelete }: { record: KeyRecord; onReset: () => void; onToggle: () => void; onDelete: () => void }) { return <article className="license-card"><div className="license-main"><div className="license-heading"><span className={`activity-status ${isActive(record) ? "active" : "revoked"}`} /><div><strong>{getRecordKey(record)}</strong><span>{record.username ?? record.user ?? "sem usuário"}</span></div><span className={`status-pill ${isActive(record) ? "pill-active" : "pill-revoked"}`}>{isActive(record) ? "Ativa" : "Revogada"}</span></div><div className="license-details"><span><b>Plano</b>Permanente</span><span><b>Data da key</b>{timestampLabel(record.createdAt)}</span><span><b>HWID / dispositivo</b>{getDevice(record) ?? "Não vinculado"}</span><span><b>Expiração</b>Sem expiração</span></div><div className="license-actions"><button onClick={onReset}>↻ Reiniciar</button><button onClick={onToggle}>{isActive(record) ? "⊘ Bloquear" : "✓ Reativar"}</button><button className="danger-action" onClick={onDelete}>♲ Excluir</button></div></div></article>; }

export { API_URL, PROFILE_PATH };
