# USER_FLOWS.md — Fluxos de Usuário

> ✅ O fluxo de consulta por áudio vem dos documentos; demais fluxos 🧩 derivados.

## 1. Cadastro e Login
```
Landing → "Criar conta" → email/SSO → verificação → onboarding (tipo de usuário) → Dashboard inicial
```
- Consulta básica pode ser anônima/gratuita ✅. Recursos avançados (API, download em massa, relatórios) exigem login.

## 2. Envio de pergunta ao sistema
```
Abre chat → digita/fala → Xingú interpreta → (se ambíguo) pergunta de volta → executa → resposta + fontes → oferece próximo passo
```

## 3. Upload de documento
```
Documentos/Chat → envia arquivo → OCR/extração → confirma o que foi entendido → indexação → disponível para consulta
```

## 4. Pedido de relatório
```
Seleciona localidade + tema → "Gerar relatório" → escolhe formato (PDF/planilha) → processamento assíncrono → notificação → download (com fontes/data)
```

## 5. Consulta por município/região/tema
```
Escolhe nível de recorte (Estado/município/região/consórcio) → tema → subtemas → visualiza (lista/mapa/gráfico) → exporta
```

## 6. Geração de dashboard
```
Escolhe indicadores + recorte + comparativos → dashboard renderizado → salva/compartilha
```

## 7. Geração de PDF
```
A partir de qualquer resultado → "Exportar PDF" → agente de PDF compõe → download
```

## 8. Comando por áudio ✅
```
Toca no microfone → fala → STT → resposta em texto e áudio (TTS) → oferta proativa de aprofundamento
```
Exemplo de referência: pergunta sobre km de estrada vicinal → resposta + "Você deseja um relatório por município?".

## 9. Consulta com múltiplos agentes
```
Pergunta complexa → Xingú decompõe → executa agentes em paralelo (Dados + GIS + Visualização) → consolida → entrega unificada
```

## 10. Validação e revisão humana
```
Resultado de baixa confiança → fila de revisão → revisor aprova/corrige → resposta liberada → log registrado
```

## 11. Coleta domiciliar (Fase 3) ✅
```
Agente de saúde abre app → seleciona domicílio → questionário curto (offline) → consentimento → sincroniza ao reconectar → recompensa registrada
```

## Diagrama da jornada principal (consulta)

```
Usuário ──pergunta──► Chat ──► Xingú ──interpreta──► decompõe ──► agentes
                                   │                                │
                                   ◄────── valida + cita fonte ◄────┘
                                   │
                                   ▼
                          Resposta (texto/áudio/mapa/relatório) + sugestão
```
