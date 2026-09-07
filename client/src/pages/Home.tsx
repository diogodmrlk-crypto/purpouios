import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const PROFILE_PATH = "/purpouios.mobileconfig";

const progressCopy = [
  { max: 30, label: "Conectando...", message: "Conectando ao servidor..." },
  { max: 65, label: "Baixando DNS...", message: "Baixando perfil de configuração..." },
  { max: 90, label: "Preparando...", message: "Preparando instalação..." },
  { max: 100, label: "Finalizando...", message: "Quase pronto..." },
];

function getProgressCopy(value: number) {
  return progressCopy.find((item) => value < item.max) ?? progressCopy[progressCopy.length - 1];
}

export default function Home() {
  const [screen, setScreen] = useState<"login" | "panel">("login");
  const [access, setAccess] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
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

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAccess = access.trim();

    if (!trimmedAccess) {
      setError("Digite seu acesso.");
      return;
    }

    setError("");
    setScreen("panel");
    startPreparation();
  };

  const downloadProfile = () => {
    const link = document.createElement("a");
    link.href = PROFILE_PATH;
    link.download = "PURPOU-IOS.mobileconfig";
    link.setAttribute("aria-label", "Baixar perfil PURPOU IOS");
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

  return (
    <main className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <div className="container">
        {screen === "login" ? (
          <section className="card login-card" aria-labelledby="login-title">
            <div className="logo logo-blood" aria-hidden="true">🩸</div>
            <p className="eyebrow">CONFIGURAÇÃO PRIVADA · IOS</p>
            <h1 id="login-title">PurpouIOS</h1>
            <p className="subtitle">Acesso ao painel iOS</p>

            <form onSubmit={handleLogin} noValidate>
              <div className="input-box">
                <label className="sr-only" htmlFor="usuario">Seu acesso</label>
                <input
                  id="usuario"
                  type="text"
                  value={access}
                  onChange={(event) => {
                    setAccess(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Digite seu acesso"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                />
              </div>
              <button className="primary-button" type="submit">
                <span>Entrar</span>
                <span className="button-arrow" aria-hidden="true">↗</span>
              </button>
            </form>

            <p className={`error ${error ? "is-visible" : ""}`} role="alert">{error || " "}</p>
            <div className="footer">
              <span className="footer-dot" aria-hidden="true" />
              PurpouIOS <span>•</span> Sistema iOS
            </div>
          </section>
        ) : (
          <section className="card panel-card" aria-labelledby="panel-title">
            <div className="panel-header">
              <div className="logo logo-settings" aria-hidden="true">⚙️</div>
              <div>
                <p className="eyebrow">PURPOU IOS · PERFIL 01</p>
                <h2 id="panel-title">Abaixar DNS</h2>
              </div>
            </div>
            <p className="panel-description">
              Prepare o perfil de configuração para seu dispositivo.
            </p>

            <div className="progress-area" aria-live="polite">
              <div className="progress-info">
                <span>{statusLabel}</span>
                <span className={isReady ? "complete" : ""}>{progress}%</span>
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-meta">
                <span className="live-indicator" aria-hidden="true" />
                <span>{isReady ? "Perfil validado" : "Conexão segura"}</span>
              </div>
            </div>

            <p className={`status ${isReady ? "status-ready" : ""}`}>
              {statusMessage}
            </p>

            <button
              className={`primary-button activate-button ${isReady ? "is-visible" : ""}`}
              type="button"
              onClick={downloadProfile}
              disabled={!isReady}
            >
              <span>{isActivated ? "Abrir novamente" : "Ativar"}</span>
              <span className="button-arrow" aria-hidden="true">↓</span>
            </button>

            <div className="footer">
              <span className="footer-dot" aria-hidden="true" />
              PURPOU IOS <span>•</span> Perfil de configuração
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* Keep this export available for simple smoke tests without exposing app internals. */
export { PROFILE_PATH };
  
