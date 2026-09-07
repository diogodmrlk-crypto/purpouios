import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const PROFILE_PATH = "/purpouios.mobileconfig";
const API_URL = "https://69b9908ce69653ffe6a81689.mockapi.io/api/v1/Scy";
const ADMIN_KEY = import.meta.env.VITEPURPOUADMIN?.trim() ?? "";

type View = "login" | "panel" | "admin";
type KeyRecord = {
  id?: string;
  key?: string;
  code?: string;
  token?: string;
  used?: boolean;
  device?: string | null;
  expire?: number;
  type?: string;
  status?: string;
  active?: boolean;
  expiresAt?: string | number | null;
  createdAt?: string | number;
  activatedAt?: string | number | null;
  onlineAt?: string | number | null;
  history?: unknown[];
  uses?: number;
};

const progressCopy = [
  { max: 30, label: "Conectando...", message: "Conectando ao servidor..." },
  { max: 65, label: "Baixando DNS...", message: "Baixando perfil de configuração..." },
  { max: 90, label: "Preparando...", message: "Preparando instalação..." },
  { max: 100, label: "Finalizando...", message: "Quase pronto..." },
];

function getProgressCopy(value: number) {
  return progressCopy.find((item) => value < item.max) ?? progressCopy[progressCopy.length - 1];
}

function getRecordKey(record: KeyRecord) {
  return record.key ?? record.code ?? record.token ?? "";
}

function isRecordActive(record: KeyRecord) {
  const status = record.status?.toLowerCase();
  if (record.active === false || status === "inactive" || status === "disabled" || status === "expired") return false;
  if (record.expiresAt) {
    const expiresAt = typeof record.expiresAt === "number"
      ? (record.expiresAt < 1_000_000_000_000 ? record.expiresAt * 1000 : record.expiresAt)
      : new Date(record.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return false;
  }
  return true;
}

function generatePermanentKey() {
  const randomPart = () => {
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  };
  return `PURPOUIOS-perm-${randomPart()}`;
}

export default function Home() {
  const [view, setView] = useState<View>("login");
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
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const startPreparation = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    setProgress(0);
    setIsReady(false);
    setIsActivated(false);
    let nextProgress = 0;
    intervalRef.current = window.setInterval(() => {
      nextProgress += 1;
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsReady(true);
      }
    }, 25);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAccess = access.trim();
    setError("");
    setNotice("");

    if (!trimmedAccess) {
      setError(isAdminLogin ? "Digite a chave administrativa." : "Digite sua key de acesso.");
      return;
    }

    if (isAdminLogin) {
      if (!ADMIN_KEY) {
        setError("Admin desativado. Configure VITEPURPOUADMIN na Vercel.");
        return;
      }
      if (trimmedAccess !== ADMIN_KEY) {
        setError("Chave administrativa inválida.");
        return;
      }
      setView("admin");
      void loadKeys();
      return;
    }

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("api");
      const records = (await response.json()) as KeyRecord[];
      const match = records.find(
        (record) => getRecordKey(record).trim().toLowerCase() === trimmedAccess.toLowerCase() && isRecordActive(record),
      );
      if (!match) {
        setError("Key inválida, expirada ou desativada.");
        return;
      }
      setView("panel");
      startPreparation();
    } catch {
      setError("Não foi possível consultar as keys agora. Tente novamente.");
    }
  };

  async function loadKeys() {
    setIsLoadingKeys(true);
    setError("");
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("api");
      const records = (await response.json()) as KeyRecord[];
      setKeys(records.reverse());
    } catch {
      setError("Não foi possível carregar as keys da MockAPI.");
    } finally {
      setIsLoadingKeys(false);
    }
  }

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingKey(true);
    setError("");
    setNotice("");
    const value = generatePermanentKey();
    const createdAt = Math.floor(Date.now() / 1000);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: value,
          used: false,
          device: null,
          expire: 0,
          type: "permanent",
          createdAt,
          activatedAt: null,
          expiresAt: null,
          status: "active",
          onlineAt: null,
          history: [],
        }),
      });
      if (!response.ok) throw new Error("create");
      setNotice(`Key ${value} criada com sucesso.`);
      await loadKeys();
    } catch {
      setError("Não foi possível criar a key na MockAPI.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const deleteKey = async (id?: string) => {
    if (!id) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete");
      setKeys((current) => current.filter((record) => record.id !== id));
      setNotice("Key removida com sucesso.");
    } catch {
      setError("Não foi possível remover essa key.");
    }
  };

  const logout = () => {
    setView("login");
    setAccess("");
    setError("");
    setNotice("");
  };

  const downloadProfile = () => {
    const link = document.createElement("a");
    link.href = PROFILE_PATH;
    link.download = "PURPOU-IOS.mobileconfig";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setIsActivated(true);
  };

  const copy = getProgressCopy(progress);
  const statusLabel = isReady ? "Concluído" : copy.label;
  const statusMessage = isReady
    ? isActivated
      ? "Perfil aberto. Siga as instruções do iOS para instalar."
      : "Perfil pronto. Toque em Ativar para continuar."
    : copy.message;

  if (view === "admin") {
    return (
      <main className="app-shell">
        <div className="ambient ambient-left" aria-hidden="true" />
        <div className="ambient ambient-right" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="container admin-container">
          <section className="card admin-card" aria-labelledby="admin-title">
            <div className="admin-topline">
              <div className="logo logo-settings" aria-hidden="true">⚙️</div>
              <button className="text-button" type="button" onClick={logout}>Sair</button>
            </div>
            <p className="eyebrow">PURPOU IOS · CONTROLE</p>
            <h1 id="admin-title">Painel admin</h1>
            <p className="panel-description">Crie, consulte e remova as keys de acesso conectadas à MockAPI.</p>

            <form className="create-key-form" onSubmit={createKey}>
              <label htmlFor="create-key">Nova key permanente</label>
              <div className="create-key-row">
                <div className="key-format-hint" id="create-key">PURPOUIOS-perm-XXXXXXXXX</div>
                <button className="primary-button compact-button" type="submit" disabled={isSavingKey}>{isSavingKey ? "..." : "Gerar key"}</button>
              </div>
            </form>

            {error && <p className="admin-message error-message" role="alert">{error}</p>}
            {notice && <p className="admin-message success-message" role="status">{notice}</p>}

            <div className="keys-heading">
              <span>Keys cadastradas</span>
              <button className="refresh-button" type="button" onClick={() => void loadKeys()} disabled={isLoadingKeys}>{isLoadingKeys ? "Atualizando..." : "Atualizar"}</button>
            </div>
            <div className="key-list">
              {isLoadingKeys ? <p className="empty-state">Consultando MockAPI...</p> : keys.length === 0 ? <p className="empty-state">Nenhuma key cadastrada ainda.</p> : keys.map((record) => (
                <div className="key-row" key={record.id ?? getRecordKey(record)}>
                  <div>
                    <strong>{getRecordKey(record) || "Sem key"}</strong>
                    <span>{record.status ?? (record.active === false ? "inactive" : "active")}</span>
                  </div>
                  <button className="delete-button" type="button" onClick={() => void deleteKey(record.id)} disabled={!record.id}>Remover</button>
                </div>
              ))}
            </div>
            <div className="footer"><span className="footer-dot" aria-hidden="true" /> PURPOU IOS <span>•</span> Área restrita</div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="container">
        {view === "login" ? (
          <section className="card login-card" aria-labelledby="login-title">
            <div className="logo logo-blood" aria-hidden="true">🩸</div>
            <p className="eyebrow">CONFIGURAÇÃO PRIVADA · IOS</p>
            <h1 id="login-title">PurpouIOS</h1>
            <p className="subtitle">{isAdminLogin ? "Acesso administrativo" : "Acesso ao painel iOS"}</p>
            <form onSubmit={handleLogin} noValidate>
              <div className="input-box">
                <label className="sr-only" htmlFor="usuario">{isAdminLogin ? "Chave administrativa" : "Key de acesso"}</label>
                <input id="usuario" type="text" value={access} onChange={(event) => { setAccess(event.target.value); if (error) setError(""); }} placeholder={isAdminLogin ? "Digite a chave admin" : "Digite sua key de acesso"} autoComplete="off" autoCapitalize="none" spellCheck="false" />
              </div>
              <button className="primary-button" type="submit"><span>Entrar</span><span className="button-arrow" aria-hidden="true">↗</span></button>
            </form>
            <p className={`error ${error ? "is-visible" : ""}`} role="alert">{error || " "}</p>
            <button className="admin-link" type="button" onClick={() => { setIsAdminLogin((current) => !current); setAccess(""); setError(""); }}>
              {isAdminLogin ? "Voltar para acesso por key" : "Acesso administrativo"}
            </button>
            <div className="footer"><span className="footer-dot" aria-hidden="true" /> PurpouIOS <span>•</span> Sistema iOS</div>
          </section>
        ) : (
          <section className="card panel-card" aria-labelledby="panel-title">
            <div className="panel-header"><div className="logo logo-settings" aria-hidden="true">⚙️</div><div><p className="eyebrow">PURPOU IOS · PERFIL 01</p><h2 id="panel-title">Abaixar DNS</h2></div></div>
            <p className="panel-description">Prepare o perfil de configuração para seu dispositivo.</p>
            <div className="progress-area" aria-live="polite"><div className="progress-info"><span>{statusLabel}</span><span className={isReady ? "complete" : ""}>{progress}%</span></div><div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span className="live-indicator" aria-hidden="true" /><span>{isReady ? "Perfil validado" : "Conexão segura"}</span></div></div>
            <p className={`status ${isReady ? "status-ready" : ""}`}>{statusMessage}</p>
            <button className={`primary-button activate-button ${isReady ? "is-visible" : ""}`} type="button" onClick={downloadProfile} disabled={!isReady}><span>{isActivated ? "Abrir novamente" : "Ativar"}</span><span className="button-arrow" aria-hidden="true">↓</span></button>
            <div className="footer"><span className="footer-dot" aria-hidden="true" /> PURPOU IOS <span>•</span> Perfil de configuração</div>
          </section>
        )}
      </div>
    </main>
  );
}

export { API_URL, PROFILE_PATH };
