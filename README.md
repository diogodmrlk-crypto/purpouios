# PurpouIOS

Painel mobile em React + TypeScript que reproduz o visual do HTML original e prepara o perfil de configuração para iOS.

## Desenvolvimento local

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm check
pnpm build
```

O arquivo `client/public/purpouios.mobileconfig` é servido na raiz como `/purpouios.mobileconfig`. Ao tocar em **Ativar**, o navegador abre/baixa esse perfil para que o iOS possa continuar a instalação.

## Deploy na Vercel

O projeto usa Vite e pode ser importado diretamente na Vercel. As configurações do `vercel.json` apontam o build para `dist/public` e mantêm o fallback SPA.

> Observação: o conteúdo do `.mobileconfig` foi mantido exatamente conforme fornecido. Ele contém um payload de configuração genérico; para aplicar um DNS específico no iOS, o payload precisa incluir uma configuração DNS compatível com o serviço desejado.
