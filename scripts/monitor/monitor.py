from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from shutil import disk_usage
from typing import Any

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover - optional runtime dependency
    psutil = None


SCHEMA = """
create table if not exists checks (
  id integer primary key autoincrement,
  checked_at text not null,
  target_name text not null,
  url text not null,
  ok integer not null,
  status_code integer,
  response_time_ms integer,
  content_check_ok integer,
  ssl_days_remaining integer,
  error_message text
);

create table if not exists system_metrics (
  id integer primary key autoincrement,
  checked_at text not null,
  hostname text not null,
  platform text not null,
  cpu_percent real,
  memory_percent real,
  disk_percent real,
  process_count integer,
  uptime_seconds integer
);
"""

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "config.json"
COLOR_ENABLED = os.environ.get("NO_COLOR") is None

COLORS = {
    "green": "\033[32m",
    "red": "\033[31m",
    "yellow": "\033[33m",
    "cyan": "\033[36m",
    "dim": "\033[2m",
    "bold": "\033[1m",
    "reset": "\033[0m",
}


@dataclass
class Target:
    name: str
    url: str
    expected_status: int
    content_must_include: str
    ssl_check: bool


@dataclass
class CheckResult:
    target_name: str
    url: str
    ok: bool
    status_code: int | None
    response_time_ms: int | None
    content_check_ok: bool | None
    ssl_days_remaining: int | None
    error_message: str | None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_now_label() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def color(text: str, color_name: str) -> str:
    if not COLOR_ENABLED:
        return text

    return f"{COLORS[color_name]}{text}{COLORS['reset']}"


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        example_path = path.with_name("config.example.json")
        raise FileNotFoundError(
            f"Config file not found: {path}. "
            f"Create it from {example_path} or pass --config."
        )

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def parse_targets(config: dict[str, Any]) -> list[Target]:
    targets = []

    for raw_target in config.get("targets", []):
        targets.append(
            Target(
                name=str(raw_target["name"]),
                url=str(raw_target["url"]),
                expected_status=int(raw_target.get("expected_status", 200)),
                content_must_include=str(
                    raw_target.get("content_must_include", "")
                ),
                ssl_check=bool(raw_target.get("ssl_check", True)),
            )
        )

    return targets


def init_database(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.executescript(SCHEMA)
    connection.commit()
    return connection


def check_target(target: Target, timeout_seconds: int) -> CheckResult:
    started_at = time.perf_counter()
    status_code = None
    body = ""
    error_message = None

    request = urllib.request.Request(
        target.url,
        headers={"User-Agent": "quinta-da-torta-monitor/1.0"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status_code = response.status
            body = response.read(256_000).decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as error:
        status_code = error.code
        body = error.read(256_000).decode("utf-8", errors="ignore")
    except Exception as error:  # noqa: BLE001 - monitoring must capture failures
        error_message = str(error)

    response_time_ms = int((time.perf_counter() - started_at) * 1000)
    content_check_ok = (
        target.content_must_include in body
        if target.content_must_include
        else None
    )
    ssl_days_remaining = (
        get_ssl_days_remaining(target.url, timeout_seconds)
        if target.ssl_check
        else None
    )
    ok = (
        error_message is None
        and status_code == target.expected_status
        and content_check_ok is not False
        and (ssl_days_remaining is None or ssl_days_remaining >= 7)
    )

    return CheckResult(
        target_name=target.name,
        url=target.url,
        ok=ok,
        status_code=status_code,
        response_time_ms=response_time_ms,
        content_check_ok=content_check_ok,
        ssl_days_remaining=ssl_days_remaining,
        error_message=error_message,
    )


def get_ssl_days_remaining(url: str, timeout_seconds: int) -> int | None:
    parsed_url = urllib.parse.urlparse(url)

    if parsed_url.scheme != "https" or not parsed_url.hostname:
        return None

    port = parsed_url.port or 443
    context = ssl.create_default_context()

    try:
        with socket.create_connection(
            (parsed_url.hostname, port),
            timeout=timeout_seconds,
        ) as tcp_socket:
            with context.wrap_socket(
                tcp_socket,
                server_hostname=parsed_url.hostname,
            ) as tls_socket:
                certificate = tls_socket.getpeercert()
    except Exception:
        return None

    not_after = certificate.get("notAfter")

    if not not_after:
        return None

    expires_at = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(
        tzinfo=timezone.utc
    )

    return (expires_at - datetime.now(timezone.utc)).days


def save_check(connection: sqlite3.Connection, result: CheckResult) -> None:
    connection.execute(
        """
        insert into checks (
          checked_at,
          target_name,
          url,
          ok,
          status_code,
          response_time_ms,
          content_check_ok,
          ssl_days_remaining,
          error_message
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            utc_now(),
            result.target_name,
            result.url,
            int(result.ok),
            result.status_code,
            result.response_time_ms,
            None
            if result.content_check_ok is None
            else int(result.content_check_ok),
            result.ssl_days_remaining,
            result.error_message,
        ),
    )
    connection.commit()


def collect_system_metrics(database_path: Path) -> dict[str, Any]:
    cpu_percent = None
    memory_percent = None
    process_count = None
    uptime_seconds = None

    if psutil is not None:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory_percent = psutil.virtual_memory().percent
        process_count = len(psutil.pids())
        uptime_seconds = int(time.time() - psutil.boot_time())

    disk = disk_usage(database_path.parent)
    disk_percent = round((disk.used / disk.total) * 100, 2)

    return {
        "checked_at": utc_now(),
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "cpu_percent": cpu_percent,
        "memory_percent": memory_percent,
        "disk_percent": disk_percent,
        "process_count": process_count,
        "uptime_seconds": uptime_seconds,
    }


def save_system_metrics(
    connection: sqlite3.Connection,
    metrics: dict[str, Any],
) -> None:
    connection.execute(
        """
        insert into system_metrics (
          checked_at,
          hostname,
          platform,
          cpu_percent,
          memory_percent,
          disk_percent,
          process_count,
          uptime_seconds
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            metrics["checked_at"],
            metrics["hostname"],
            metrics["platform"],
            metrics["cpu_percent"],
            metrics["memory_percent"],
            metrics["disk_percent"],
            metrics["process_count"],
            metrics["uptime_seconds"],
        ),
    )
    connection.commit()


def count_recent_failures(
    connection: sqlite3.Connection,
    target_name: str,
    failure_threshold: int,
) -> int:
    rows = connection.execute(
        """
        select ok
        from checks
        where target_name = ?
        order by id desc
        limit ?
        """,
        (target_name, failure_threshold),
    ).fetchall()

    consecutive_failures = 0

    for row in rows:
        if row[0] == 1:
            break

        consecutive_failures += 1

    return consecutive_failures


def send_alert(webhook_url: str, result: CheckResult, failure_count: int) -> None:
    if not webhook_url:
        return

    payload = {
        "content": (
            f"[ALERTA] {result.target_name} falhou {failure_count} vezes "
            f"seguidas. status={result.status_code} "
            f"latency_ms={result.response_time_ms} error={result.error_message}"
        )
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        urllib.request.urlopen(request, timeout=10).close()
    except Exception:
        pass


def run_once(
    connection: sqlite3.Connection,
    config: dict[str, Any],
    database_path: Path,
) -> tuple[list[CheckResult], dict[str, Any], dict[str, int]]:
    timeout_seconds = int(config.get("request_timeout_seconds", 10))
    failure_threshold = int(config.get("failure_threshold", 3))
    webhook_url = str(config.get("webhook_url", ""))
    results = []
    failure_counts = {}

    system_metrics = collect_system_metrics(database_path)
    save_system_metrics(connection, system_metrics)

    for target in parse_targets(config):
        result = check_target(target, timeout_seconds)
        save_check(connection, result)
        results.append(result)

        failure_count = count_recent_failures(
            connection,
            result.target_name,
            failure_threshold,
        )
        failure_counts[result.target_name] = failure_count

        if not result.ok and failure_count >= failure_threshold:
            send_alert(webhook_url, result, failure_count)

    return results, system_metrics, failure_counts


def format_percent(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.1f}%"


def format_seconds(seconds: int | None) -> str:
    if seconds is None:
        return "n/a"

    days, remainder = divmod(seconds, 86_400)
    hours, remainder = divmod(remainder, 3_600)
    minutes, _seconds = divmod(remainder, 60)

    if days > 0:
        return f"{days}d {hours:02d}h"

    if hours > 0:
        return f"{hours}h {minutes:02d}m"

    return f"{minutes}m"


def format_status(result: CheckResult) -> str:
    if result.ok:
        return color("OK  ", "green")

    return color("FAIL", "red")


def format_ssl_days(days: int | None) -> str:
    if days is None:
        return "SSL n/a"

    label = f"SSL {days}d"

    if days < 7:
        return color(label, "red")

    if days < 30:
        return color(label, "yellow")

    return label


def print_results(
    results: list[CheckResult],
    system_metrics: dict[str, Any],
    failure_counts: dict[str, int],
) -> None:
    print()
    print(color(f"[{local_now_label()}] Quinta da Torta Monitor", "bold"))
    print(color("-" * 72, "dim"))

    for result in results:
        status_code = result.status_code if result.status_code is not None else "-"
        latency = (
            f"{result.response_time_ms} ms"
            if result.response_time_ms is not None
            else "n/a"
        )
        failures = failure_counts.get(result.target_name, 0)

        print(
            f"{format_status(result)}  "
            f"{result.target_name:<28} "
            f"HTTP {status_code:<4} "
            f"{latency:>8}  "
            f"{format_ssl_days(result.ssl_days_remaining):<8} "
            f"falhas={failures}"
        )

        if result.content_check_ok is False:
            print(color("      Conteudo esperado nao encontrado.", "yellow"))

        if result.error_message:
            print(color(f"      Erro: {result.error_message}", "red"))

    print(color("-" * 72, "dim"))
    print(
        "Sistema do monitor  "
        f"CPU: {format_percent(system_metrics['cpu_percent'])}   "
        f"RAM: {format_percent(system_metrics['memory_percent'])}   "
        f"Disco: {format_percent(system_metrics['disk_percent'])}   "
        f"Processos: {system_metrics['process_count'] or 'n/a'}   "
        f"Uptime: {format_seconds(system_metrics['uptime_seconds'])}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="External uptime monitor")
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to JSON config file",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one check cycle and exit",
    )
    args = parser.parse_args()

    config_path = Path(args.config)
    config = load_config(config_path)
    database_path = Path(config.get("database_path", "scripts/monitor/monitor.db"))
    connection = init_database(database_path)
    interval_seconds = int(config.get("interval_seconds", 60))

    while True:
        results, system_metrics, failure_counts = run_once(
            connection,
            config,
            database_path,
        )
        print_results(results, system_metrics, failure_counts)

        if args.once:
            break

        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
