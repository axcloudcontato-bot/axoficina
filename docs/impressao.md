# Impressão

O Ofix imprime pelo navegador, que usa qualquer impressora instalada no Windows: USB, de rede ou térmica com driver. Cada computador guarda suas próprias escolhas (no navegador), porque a impressora muda de mesa para mesa.

## Configurações → Impressão (por computador)

| Opção | Padrão | Efeito |
|---|---|---|
| Papel da OS | A4 | A4, bobina de 80 mm (72 mm úteis) ou de 58 mm (48 mm úteis). |
| Margem A4 | 12 mm | 5 a 25 mm. O resumo em duas vias se ajusta para caber em uma folha. |
| Margem da bobina | 2 mm | 0 a 8 mm, mais 4 mm no fim do cupom antes do corte. |
| Letra do cupom | Normal (12 px) | Pequena 11 px, grande 14 px. Na 58 mm, 1 px a menos. |
| Vias do cupom | 1 | Com 2, sai a via da oficina e a do cliente, com quebra de página entre elas (a guilhotina corta). |
| Imprimir a logo | Ligado | Na térmica a logo sai em tons de cinza. |
| Abrir a impressão sozinha | Desligado | Abre a janela de impressão ao carregar o documento. |
| Fechar depois de imprimir | Desligado | Fecha a aba e volta para a OS. |

Na tela de impressão da OS dá para trocar o papel só daquela vez. Links também aceitam `?formato=a4|80mm|58mm`.

## Cupom térmico da OS

Coluna única em fonte monoespaçada, só preto, com:

- dados da oficina;
- número e situação da OS;
- cliente, veículo, placa, km e técnico;
- solicitação e itens com quantidade, unitário e total;
- desconto, total, recebido, saldo e forma de pagamento;
- garantia, termos, linha de assinatura e rodapé.

O cupom termina com **"Documento sem valor fiscal"**. Quem não vê preços recebe o cupom sem os valores.

## Páginas de teste

`/impressao/teste?formato=a4|80mm|58mm`. A A4 tem uma borda e uma régua para conferir margens e verificar se cabe em uma folha. A térmica marca a largura útil, uma linha de 49 caracteres e acentos.

## Instalação (resumo do guia na tela)

- **Comum (USB/rede):** instalar no Windows. Uma impressora de rede que não aparecer pode ser adicionada manualmente pelo IP. No navegador, deixar margens e escala no padrão.
- **Térmica:** driver do fabricante, papel da bobina com comprimento contínuo e corte automático no driver. Uma térmica de rede entra como impressora TCP/IP na porta 9100.
- **Sem janela de impressão:** impressora padrão do Windows, atalho do Chrome/Edge com `--kiosk-printing` e a opção *Abrir a impressão sozinha*.

## Limites conhecidos

- O navegador não envia comandos ESC/POS crus. Abrir gaveta ou imprimir em térmica sem driver exigiria um agente local instalado no Windows (por exemplo, o QZ Tray). Isso só deve ser feito se alguma oficina precisar.
- O comprimento do cupom é definido pelo driver. Se sobrar papel, o driver está com papel de tamanho fixo em vez de contínuo.
