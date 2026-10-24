# Fotos da OS no celular

O botão **Câmera** solicita a câmera traseira. **Arquivo** permite selecionar uma foto existente. Ambos passam pela mesma preparação antes de enviar a imagem autenticada à OS e ao ângulo ou item selecionado.

- A imagem é convertida para JPEG com a maior dimensão de até 1920 pixels e qualidade ajustada para reduzir o envio. O nome recebe o sufixo `.jpg` e o tipo `image/jpeg`, mesmo quando a captura original chega sem tipo MIME.
- Para JPEG e PNG grandes, os cabeçalhos são usados para solicitar um bitmap menor ao navegador antes de criar o canvas. Caso `createImageBitmap` não exista ou falhe, há uma alternativa com um elemento de imagem e URL temporária.
- Fotos em HEIC/HEIF são convertidas somente quando o próprio navegador consegue decodificá-las. Caso contrário, a tela orienta selecionar uma cópia JPEG ou mudar o formato da câmera. Não há envio silencioso do original incompatível.
- A origem pode ter até 50 MiB. O arquivo preparado continua sujeito ao limite de 8 MiB da API. A configuração Nginx de desenvolvimento permite 10 MiB para acomodar o arquivo e os campos multipart.
- Cada posição mostra **Preparando foto**, **Enviando foto**, **Foto salva na OS** ou o motivo da falha. A confirmação depende da resposta da API. Falhas ao carregar a miniatura também são exibidas.
- Assim que a API confirma o salvamento, a foto entra na galeria local e o envio é liberado, sem aguardar uma segunda consulta. A atualização da lista ocorre em segundo plano e, se falhar, mantém as fotos já carregadas com um botão para tentar atualizar.
- Durante a preparação e o envio, os botões daquela posição ficam bloqueados. Após falha no upload, **Tentar enviar novamente** reutiliza a foto já preparada enquanto a página continua aberta. Após falha na preparação, selecione ou fotografe outra imagem.
- O envio tem limite de espera de dois minutos. Não há reenvio automático. Quando a conexão cai, confira a galeria antes de tentar novamente, pois uma resposta HTTP perdida não comprova que o servidor deixou de salvar a foto.

## Validar no aparelho

1. Abra uma OS pelo HTTPS público e entre em **Fotos de entrada do veículo**.
2. Em **Frente**, toque em **Câmera**, fotografe e confirme a captura.
3. Aguarde **Foto salva na OS** e a miniatura. Recarregue a página para confirmar que ela permanece.
4. Repita pelo botão **Arquivo**. Se falhar, informe o celular, navegador e a mensagem que ficou visível naquele espaço.

Os testes automatizados exercitam captura via seletor, foto acima de 8 MiB, orientação EXIF, tipo MIME ausente, leitura alternativa, rejeição de formato não decodificável, confirmação e repetição após erro. A interface da câmera do aparelho e o acesso à produção precisam ser validados no dispositivo real.

Para executar o conjunto nos motores Chromium e WebKit com viewport móvel, instale os navegadores do Playwright e use `pnpm --filter @oficina/frontend exec playwright test --config playwright.mobile.config.ts`. O frontend usa as respostas simuladas desses testes; a câmera nativa e o servidor de produção não são acionados.

Referências: [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [canvas.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) e [capture](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/capture).
