#!/usr/bin/env python
from __future__ import annotations

import argparse
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STORAGE_ROOT = REPO_ROOT / "apps" / "figurinhas" / "storage"
DEFAULT_DATABASE_PATH = DEFAULT_STORAGE_ROOT / "figurinhas.sqlite3"
EXPORTS_DIR_NAME = "exports"


@dataclass(frozen=True)
class ExportFile:
    relative_path: str
    absolute_path: Path
    size_bytes: int
    modified_at: float


@dataclass(frozen=True)
class ProtectedPaths:
    last_export_paths: set[str]
    order_paths: set[str]

    @property
    def all_paths(self) -> set[str]:
        return self.last_export_paths | self.order_paths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Limpa PDFs antigos de apps/figurinhas/storage/exports sem apagar "
            "o ultimo PDF salvo nas contas nem PDFs referenciados por pedidos."
        )
    )
    parser.add_argument(
        "--storage-root",
        type=Path,
        default=DEFAULT_STORAGE_ROOT,
        help=f"Diretorio storage do figurinhas. Padrao: {DEFAULT_STORAGE_ROOT}",
    )
    parser.add_argument(
        "--database-path",
        type=Path,
        default=DEFAULT_DATABASE_PATH,
        help=f"Caminho do SQLite do figurinhas. Padrao: {DEFAULT_DATABASE_PATH}",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=3,
        help="Mantem PDFs nao protegidos modificados nos ultimos N dias. Padrao: 3.",
    )
    parser.add_argument(
        "--keep-recent",
        type=int,
        default=50,
        help="Mantem pelo menos os N PDFs nao protegidos mais recentes. Padrao: 50.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Executa a exclusao. Sem essa flag, roda em dry-run.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Forca o modo de simulacao. E o comportamento padrao quando --execute nao e informado.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Mostra a lista completa de arquivos protegidos, mantidos e candidatos.",
    )
    return parser.parse_args()


def human_size(size_bytes: int) -> str:
    size = float(size_bytes)
    units = ["B", "KB", "MB", "GB", "TB"]
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size_bytes} B"


def load_protected_paths(database_path: Path) -> ProtectedPaths:
    connection = sqlite3.connect(str(database_path))
    try:
        cursor = connection.cursor()
        last_export_paths = query_existing_column_values(
            cursor,
            table_name="figurinhas_public_user_last_exports",
            column_name="file_path",
        )
        order_paths = query_existing_column_values(
            cursor,
            table_name="figurinhas_print_orders",
            column_name="export_file_path",
        )
        return ProtectedPaths(
            last_export_paths=last_export_paths,
            order_paths=order_paths,
        )
    finally:
        connection.close()


def query_existing_column_values(
    cursor: sqlite3.Cursor,
    *,
    table_name: str,
    column_name: str,
) -> set[str]:
    table_exists = cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    if not table_exists:
        return set()

    rows = cursor.execute(
        f"SELECT {column_name} FROM {table_name} "
        f"WHERE {column_name} IS NOT NULL AND TRIM({column_name}) != ''"
    ).fetchall()
    return {normalize_relative_path(row[0]) for row in rows if row and row[0]}


def normalize_relative_path(value: str) -> str:
    return value.strip().replace("\\", "/").lstrip("/")


def iter_export_files(storage_root: Path) -> Iterable[ExportFile]:
    exports_root = (storage_root / EXPORTS_DIR_NAME).resolve()
    for path in sorted(exports_root.rglob("*.pdf")):
        if not path.is_file():
            continue
        resolved = path.resolve()
        resolved.relative_to(exports_root)
        stat = resolved.stat()
        relative_path = resolved.relative_to(storage_root.resolve()).as_posix()
        yield ExportFile(
            relative_path=relative_path,
            absolute_path=resolved,
            size_bytes=int(stat.st_size),
            modified_at=float(stat.st_mtime),
        )


def build_cleanup_plan(
    files: list[ExportFile],
    protected_paths: ProtectedPaths,
    *,
    retention_days: int,
    keep_recent: int,
) -> dict[str, list[ExportFile]]:
    protected: list[ExportFile] = []
    unprotected: list[ExportFile] = []
    for item in files:
        if item.relative_path in protected_paths.all_paths:
            protected.append(item)
        else:
            unprotected.append(item)

    unprotected_sorted = sorted(unprotected, key=lambda item: item.modified_at, reverse=True)
    keep_recent_paths = {item.relative_path for item in unprotected_sorted[: max(keep_recent, 0)]}
    retention_cutoff = datetime.now(timezone.utc).timestamp() - max(retention_days, 0) * 86400

    kept_by_policy: list[ExportFile] = []
    deletion_candidates: list[ExportFile] = []
    for item in unprotected_sorted:
        if item.relative_path in keep_recent_paths or item.modified_at >= retention_cutoff:
            kept_by_policy.append(item)
        else:
            deletion_candidates.append(item)

    return {
        "protected": protected,
        "kept_by_policy": kept_by_policy,
        "deletion_candidates": deletion_candidates,
    }


def print_report(
    *,
    storage_root: Path,
    database_path: Path,
    protected_paths: ProtectedPaths,
    files: list[ExportFile],
    plan: dict[str, list[ExportFile]],
    retention_days: int,
    keep_recent: int,
    execute: bool,
    verbose: bool,
) -> None:
    protected = plan["protected"]
    kept_by_policy = plan["kept_by_policy"]
    deletion_candidates = plan["deletion_candidates"]
    protected_last = {item.relative_path for item in protected if item.relative_path in protected_paths.last_export_paths}
    protected_orders = {item.relative_path for item in protected if item.relative_path in protected_paths.order_paths}

    print(f"Modo: {'EXECUTE' if execute else 'DRY-RUN'}")
    print(f"Storage root: {storage_root}")
    print(f"Database path: {database_path}")
    print(f"Janela de retencao: {retention_days} dia(s)")
    print(f"Manter nao protegidos mais recentes: {keep_recent}")
    print()
    print(f"PDFs encontrados: {len(files)}")
    print(f"Protegidos por ultimo PDF da conta: {len(protected_last)}")
    print(f"Protegidos por pedidos: {len(protected_orders)}")
    print(f"Protegidos no total: {len(protected)} ({human_size(sum(item.size_bytes for item in protected))})")
    print(
        "Mantidos por politica (nao protegidos recentes): "
        f"{len(kept_by_policy)} ({human_size(sum(item.size_bytes for item in kept_by_policy))})"
    )
    print(
        f"Candidatos a exclusao: {len(deletion_candidates)} "
        f"({human_size(sum(item.size_bytes for item in deletion_candidates))})"
    )
    print()

    if verbose:
        print_items("Protegidos", protected)
        print_items("Mantidos por politica", kept_by_policy)
        print_items("Candidatos a exclusao", deletion_candidates)
    else:
        print_items("Exemplo de candidatos a exclusao", deletion_candidates[:10])


def print_items(title: str, items: Iterable[ExportFile]) -> None:
    materialized = list(items)
    print(title + ":")
    if not materialized:
        print("  (nenhum)")
        print()
        return

    for item in materialized:
        modified_at = datetime.fromtimestamp(item.modified_at, tz=timezone.utc).astimezone().strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        print(f"  - {item.relative_path} | {human_size(item.size_bytes)} | {modified_at}")
    print()


def delete_candidates(candidates: Iterable[ExportFile], exports_root: Path) -> tuple[int, int, list[str]]:
    deleted_count = 0
    deleted_bytes = 0
    errors: list[str] = []

    for item in candidates:
        try:
            resolved = item.absolute_path.resolve()
            resolved.relative_to(exports_root.resolve())
            resolved.unlink(missing_ok=False)
            deleted_count += 1
            deleted_bytes += item.size_bytes
        except FileNotFoundError:
            continue
        except OSError as exc:
            errors.append(f"{item.relative_path}: {exc}")

    return deleted_count, deleted_bytes, errors


def main() -> int:
    args = parse_args()
    storage_root = args.storage_root.resolve()
    database_path = args.database_path.resolve()
    exports_root = storage_root / EXPORTS_DIR_NAME

    if not storage_root.exists():
        print(f"Storage root nao encontrado: {storage_root}", file=sys.stderr)
        return 1
    if not database_path.exists():
        print(f"Banco nao encontrado: {database_path}", file=sys.stderr)
        return 1
    if not exports_root.exists():
        print(f"Pasta de exports nao encontrada: {exports_root}", file=sys.stderr)
        return 1

    protected_paths = load_protected_paths(database_path)
    files = list(iter_export_files(storage_root))
    plan = build_cleanup_plan(
        files,
        protected_paths,
        retention_days=args.retention_days,
        keep_recent=args.keep_recent,
    )

    print_report(
        storage_root=storage_root,
        database_path=database_path,
        protected_paths=protected_paths,
        files=files,
        plan=plan,
        retention_days=args.retention_days,
        keep_recent=args.keep_recent,
        execute=args.execute,
        verbose=args.verbose,
    )

    if not args.execute:
        print("Dry-run finalizado. Nada foi apagado.")
        return 0

    deleted_count, deleted_bytes, errors = delete_candidates(plan["deletion_candidates"], exports_root)
    print(
        f"Exclusao concluida: {deleted_count} arquivo(s) apagado(s), "
        f"{human_size(deleted_bytes)} liberados."
    )
    if errors:
        print("Falhas durante a exclusao:")
        for error in errors:
            print(f"  - {error}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
