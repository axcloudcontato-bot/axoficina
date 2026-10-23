# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipe variada de uma oficina mecânica, multi-tenant (cada oficina é um tenant isolado):

- **Balcão/recepção** — cadastra clientes e veículos, abre ordens de serviço, agenda horários, consulta financeiro básico. Uso principal: desktop, durante o expediente.
- **Mecânico** — trabalha a partir da ordem de serviço (itens, status, fotos). Pode precisar de uso no chão de oficina (tablet), não só no balcão.
- **Financeiro** — fecha contas, lança categorias/fornecedores/recebíveis, concilia parcelas de OS.
- **Gerente/dono (ADMIN)** — visão geral, configura a oficina, gerencia usuários e perfis de acesso.

Papéis confirmados no sistema: ADMIN, MANAGER, MECHANIC, FRONT_DESK, FINANCE, com permissões granulares (perfis de acesso customizáveis além dos papéis fixos).

## Product Purpose

ERP SaaS multi-tenant para gestão operacional de oficinas mecânicas: do agendamento e abertura de ordem de serviço até o faturamento e histórico do veículo, em um único sistema. Sucesso = a oficina roda o dia a dia (atendimento, execução, cobrança) sem planilhas paralelas, com dados confiáveis entre papéis.

## Positioning

Diferencial declarado pelo usuário: simplicidade e UX muito superior aos sistemas de gestão de oficina já estabelecidos no Brasil, que são percebidos como datados/complicados. O Ax Oficina busca ganhar por ser rápido, bonito e aprendível sem treinamento formal — não por recurso exclusivo de arquitetura.

## Operating Context

Fluxo típico: cliente chega → cadastro/consulta de cliente e veículo (com integração FIPE para marca/modelo/valor) → abertura de ordem de serviço → execução pelo mecânico (itens, peças, serviços, fotos, histórico de status) → orçamento/aprovação → parcelas/recibo → fechamento financeiro → alertas automáticos de manutenção futura para aquele veículo.

Módulos confirmados no código: autenticação (signup cria tenant + admin), dashboard, clientes (PF/PJ), veículos, ordens de serviço, financeiro (categorias, fornecedores, lançamentos, parcelas), alertas de manutenção (scan automatizado), agendamentos, usuários, perfis de acesso customizados, convite de usuário por token, configurações da oficina. Há também telas de impressão dedicadas (ordens de serviço e financeiro em A4) — layout de impressão é requisito real, não cosmético.

## Capabilities and Constraints

Stack existente (não é decisão de design desta rodada): Next.js App Router, Tailwind CSS, shadcn/ui, TanStack Query, Zustand no frontend; NestJS + Prisma + PostgreSQL + Redis/BullMQ no backend. Tema claro/escuro já implementado via `.dark` em `globals.css`.

Multi-tenant: autorização por tenant + papel + permissão granular já existe e deve continuar visível/confiável na interface (ex.: usuário sempre sabe em qual oficina está atuando).

## Brand Commitments

Produto feito pela empresa **Ax Cloud** (nome confirmado pelo usuário e pelo autor dos commits do repositório). Não existe, no repositório ou na máquina do usuário, nenhum arquivo de logo, guia de marca ou paleta formalmente documentada — isso é uma decisão em aberto a resolver na etapa de direção visual, não um compromisso já fechado.

Observação de evidência (não é compromisso confirmado): a implementação atual usa laranja (`--orange-700` claro / `--orange-400` escuro) como cor primária em todo o produto. Tratar como ponto de partida a avaliar, não como paleta de marca obrigatória.

**Direção visual confirmada (2026-10-22):** diante das opções apresentadas (ver rodada de direção visual), o usuário escolheu a saída padrão/consagrada — um painel "SaaS moderno" neutro, calmo, com uma cor de acento só — em vez das direções mais distintas/arriscadas. Régua de qualidade de acabamento fixada: **Linear**. Isso vira commitment de marca: o painel deve alcançar o nível de polimento, precisão tipográfica e calma visual do Linear, executado com fidelidade total (sem ironia ou floreio "customizado" por cima).

## Evidence on Hand

Nenhum asset de marca real (logo, guia de estilo, paleta oficial) disponível. Nenhum depoimento, case de cliente ou dado de uso real disponível — não inventar números, clientes ou provas sociais em qualquer trabalho visual futuro.

## Product Principles

1. Clareza operacional acima de ornamentação — cada tela existe para apoiar uma decisão ou ação dentro do fluxo real da oficina.
2. Zero curva de aprendizado — qualquer papel (balcão, mecânico, financeiro, gerente) deve entender a tela sem treinamento formal.
3. Confiança multi-tenant — cada oficina deve sentir que o sistema é "dela": dados isolados, papel e permissão sempre visíveis.
4. Velocidade percebida — ações frequentes (abrir OS, buscar cliente/veículo, fechar conta) devem parecer instantâneas.
5. Consistência entre papéis — mesma linguagem visual do dono ao mecânico, com densidade de informação ajustada ao contexto de uso (balcão em desktop vs. chão de oficina em tablet).
