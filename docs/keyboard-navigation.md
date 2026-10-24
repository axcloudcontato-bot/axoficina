# Navegação por teclado

A navegação foi implementada nos componentes compartilhados e nos fluxos de busca, agenda e quadro de ordens de serviço. Os controles nativos mantêm os comportamentos do navegador; Tab não foi convertido em Enter, e digitar letras isoladas não dispara ações globais.

## Comandos disponíveis

| Tecla | Comportamento |
| --- | --- |
| Primeiro Tab da página | Exibe “Pular para o conteúdo principal”; Enter leva o foco ao conteúdo |
| Tab / Shift+Tab | Próximo/anterior controle; o foco fica visível, inclusive em alto contraste |
| Ctrl+K / ⌘K | Abre a busca de páginas e ordens de serviço no cabeçalho autenticado |
| Ctrl+/ / ⌘/ | Abre a ajuda dos atalhos; também há um botão no cabeçalho |
| ↑ / ↓ na busca do cabeçalho | Percorre o campo e os resultados; Enter abre o destino |
| ↑ / ↓ no botão de um menu | Abre o menu no primeiro/último controle |
| Setas nos menus | Percorre os controles; no tema, ← / → também funcionam |
| Escape em menu | Fecha e devolve o foco ao controle anterior |
| Escape em busca de cliente/veículo | Fecha primeiro as sugestões, inclusive durante carregamento; um segundo Escape pode fechar o formulário |
| ↑ / ↓ em sugestões | Muda a opção anunciada, mantendo o foco no campo; Enter seleciona sem submeter o formulário |
| Tab em sugestões | Fecha a lista e segue ao próximo campo; as opções não criam paradas extras |
| Enter / Espaço em botões | Ativa o botão; links usam Enter, conforme o comportamento nativo |
| Setas na agenda | ← / → mudam o dia; ↑ / ↓ mudam a linha de dias dentro do período visível |
| Home / End na agenda | Primeiro/último dia da linha; Ctrl/⌘+Home/End vai ao início/fim do período exibido |

Os atalhos globais não abrem um painel por cima de uma janela modal nem durante composição de texto (IME). Editores com `contenteditable` preservam seus próprios atalhos. A ajuda também fica disponível por Tab quando uma combinação é reservada pelo navegador, pelo sistema ou pelo layout do teclado.

## Foco e autorização

- A mudança de página leva o foco ao conteúdo principal. Não há foco automático no carregamento inicial, permitindo começar pelo link de salto.
- Menus do cabeçalho têm uma única instância visível do conteúdo, com estado expandido e controle associado. Os elementos duplicados usados anteriormente para medir a animação foram removidos.
- Menus não prendem Tab: ao sair do último item, o foco segue após o controle que abriu o painel. Shift+Tab no início e Escape retornam ao controle anterior.
- Janelas Radix conservam o foco modal. Ao fechar, inclusive após salvar um formulário, o foco retorna ao elemento que abriu a janela; se ele foi removido, retorna ao conteúdo principal. Formulários apresentados como página mantêm seu comportamento não modal.
- Menus laterais recolhidos continuam tendo nomes acessíveis. Recolher/expandir o menu preserva o foco no botão correspondente.
- A busca de páginas respeita as permissões da sessão; as APIs continuam responsáveis pela autorização. Buscar uma OS exige permissão para visualizar ordens de serviço.

## Agenda e quadro de OS

Cada dia tem um botão para criar horário e cada agendamento tem seu próprio botão. Não há botão interativo dentro de outro botão. Selecionar um agendamento com Espaço ou Enter não dispara a criação de outro horário. Todos os agendamentos do mês ficam acessíveis, inclusive quando há mais de três no mesmo dia. Um único botão de dia participa da sequência de Tab; as setas acessam os demais, e os agendamentos permanecem acessíveis por Tab.

No quadro, o seletor “Mover OS #… para outra etapa” permite escolher qualquer transição válida pelo teclado. A mesma confirmação é exigida antes de enviar a alteração. Arrastar e o botão de avanço continuam disponíveis. Usuários sem permissão de gestão não recebem o seletor de mudança.

## Validação

Testes de componentes cobrem atalhos, permissões, foco inicial/restauração, Tab, setas, Escape em sugestões dentro de modal, ativação de agendamentos e confirmação de mudança no quadro. Os testes de navegador em `frontend/e2e/keyboard-navigation.spec.ts` exercitam percursos sem mouse, formulários, navegação entre páginas, menu lateral recolhido e viewport móvel. As APIs são simuladas nesses testes de interface, sem alteração de dados reais.

Referências de interação: [W3C — interfaces de teclado](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) e [W3C — combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). Esta entrega não equivale a uma auditoria completa ou certificação de acessibilidade de todas as telas.
