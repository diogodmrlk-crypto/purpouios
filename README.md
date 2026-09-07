# PurpouIOS

Painel mobile em React + TypeScript que reproduz o visual do HTML original e prepara o perfil de configuração para iOS.

## Login por key

As keys são consultadas no endpoint MockAPI configurado em `client/src/pages/Home.tsx`:

```text
https://69b9908ce69653ffe6a81689.mockapi.io/api/v1/Scy
```

O login aceita registros com qualquer um dos campos `key`, `code` ou `token`. Registros com `active: false`, `status: inactive/disabled/expired` ou `expiresAt` já vencido são rejeitados.

## Painel admin

O link **Acesso administrativo** abre o painel de gerenciamento. A chave admin é lida de `VITEPURPOUADMIN`; configure essa variável na Vercel. O painel permite:

- listar as keys atuais da MockAPI;
- criar uma key manual ou gerar uma automaticamente;
- remover keys por ID.

Como este projeto é um frontend estático, `VITEPURPOUADMIN` é incorporada ao bundle do navegador e não deve ser tratada como segredo forte. Para controle administrativo realmente seguro, migre a validação e o CRUD para uma API server-side com autenticação.

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

O projeto usa Vite e pode ser importado diretamente na Vercel. As configurações do `vercel.json` apontam o build para `dist/public` e mantêm o fallback SPA. No projeto da Vercel, adicione `VITEPURPOUADMIN` com o valor `PURPOU2002` antes de publicar.

> Observação: o conteúdo do `.mobileconfig` foi mantido exatamente conforme fornecido. Ele contém um payload de configuração genérico; para aplicar um DNS específico no iOS, o payload precisa incluir uma configuração DNS compatível com o serviço desejado.
