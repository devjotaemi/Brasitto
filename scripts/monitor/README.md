# Monitor externo

Monitor apartado do app principal. Ele roda por fora da Vercel/Supabase, testa
URLs publicas, registra historico em SQLite e coleta metricas da maquina onde o
monitor estiver rodando.

## Uso

1. Copie a configuracao:

```powershell
Copy-Item scripts\monitor\config.example.json scripts\monitor\config.json
```

2. Edite `scripts/monitor/config.json` com o dominio real.

3. Rode uma checagem unica:

```powershell
python scripts\monitor\monitor.py --config scripts\monitor\config.json --once
```

4. Rode continuamente:

```powershell
python scripts\monitor\monitor.py --config scripts\monitor\config.json
```

## Banco

O SQLite fica em `scripts/monitor/monitor.db` por padrao.

Tabelas:

- `checks`: resultado por alvo monitorado.
- `system_metrics`: CPU/RAM/disco da maquina do monitor.

## Alertas

Opcionalmente preencha `webhook_url` no `config.json`. O monitor envia alerta
quando um alvo falha `failure_threshold` vezes seguidas.

Webhooks compatíveis com payload JSON simples, como Discord, funcionam direto.

## CPU e RAM

Para CPU/RAM/processos com mais precisao, instale `psutil`:

```powershell
pip install psutil
```

Sem `psutil`, o monitor continua registrando uptime e uso de disco.
