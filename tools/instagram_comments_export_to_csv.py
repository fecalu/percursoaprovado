from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator


INDEX_RE = re.compile(r"\[\d+\]")
COMMENT_HINT_RE = re.compile(r"comment", re.IGNORECASE)
INSTAGRAM_URL_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[^\s\"']+")


USERNAME_KEYS = [
    "node.owner.username",
    "owner.username",
    "user.username",
    "from.username",
    "author.username",
    "commenter.username",
    "string_map_data.Author.value",
    "string_map_data.Username.value",
    "string_map_data.Commenter.value",
    "string_map_data.Owner.value",
    "username",
]

DISPLAY_NAME_KEYS = [
    "node.owner.full_name",
    "owner.full_name",
    "user.full_name",
    "from.full_name",
    "author.full_name",
    "commenter.full_name",
    "string_map_data.Name.value",
    "full_name",
    "name",
]

TEXT_KEYS = [
    "node.text",
    "text",
    "comment_text",
    "comment",
    "string_map_data.Comment.value",
    "string_map_data.Text.value",
    "title",
]

TIMESTAMP_KEYS = [
    "created_at",
    "created_time",
    "timestamp",
    "time",
    "string_map_data.Time.timestamp",
    "string_map_data.Created.timestamp",
]

COMMENT_ID_KEYS = [
    "node.id",
    "comment_id",
    "id",
    "pk",
]

PARENT_ID_KEYS = [
    "parent_comment_id",
    "parent_id",
    "node.parent_id",
]

MEDIA_URI_KEYS = [
    "media_list_data.uri",
    "permalink",
    "shortcode_permalink",
    "href",
    "string_map_data.Link.href",
    "string_map_data.Post.href",
]


@dataclass
class SourceFile:
    name: str
    text: str


def canonical_key(key: str) -> str:
    return INDEX_RE.sub("", key)


def flatten_scalars(value: Any, prefix: str = "") -> Iterator[tuple[str, Any]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            yield from flatten_scalars(child, child_prefix)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            child_prefix = f"{prefix}[{index}]"
            yield from flatten_scalars(child, child_prefix)
        return
    yield prefix, value


def clean_scalar(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def first_match(flat_items: list[tuple[str, str]], candidates: list[str]) -> str | None:
    for candidate in candidates:
        exact = [value for key, value in flat_items if key == candidate and value]
        if exact:
            return exact[0]
        suffix = f".{candidate}"
        partial = [value for key, value in flat_items if key.endswith(suffix) and value]
        if partial:
            return partial[0]
    return None


def parse_timestamp(raw_value: str | None) -> tuple[str | None, str | None]:
    if not raw_value:
        return None, None

    text = raw_value.strip()
    if not text:
        return None, None

    try:
        number = float(text)
        if number > 1_000_000_000_000:
            number /= 1000.0
        dt = datetime.fromtimestamp(number, tz=timezone.utc)
        return str(int(number)), dt.isoformat()
    except ValueError:
        pass

    try:
        iso_text = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return None, dt.isoformat()
    except ValueError:
        return None, text


def normalize_username(raw_username: str | None) -> str | None:
    if not raw_username:
        return None
    username = raw_username.strip()
    if username.startswith("@"):
        username = username[1:]
    return username or None


def pick_instagram_url(values: Iterable[str | None]) -> str | None:
    for value in values:
        if not value:
            continue
        match = INSTAGRAM_URL_RE.search(value)
        if match:
            return match.group(0)
    return None


def looks_like_comment_dict(node: dict[str, Any], source_name: str, path_hint: str) -> bool:
    flat_items = [
        (canonical_key(key), cleaned)
        for key, value in flatten_scalars(node)
        if (cleaned := clean_scalar(value)) is not None
    ]
    if not flat_items:
        return False

    username = first_match(flat_items, USERNAME_KEYS)
    text = first_match(flat_items, TEXT_KEYS)
    timestamp = first_match(flat_items, TIMESTAMP_KEYS)
    comment_id = first_match(flat_items, COMMENT_ID_KEYS)

    score = 0
    if COMMENT_HINT_RE.search(source_name) or COMMENT_HINT_RE.search(path_hint):
        score += 2
    if text:
        score += 1
    if username:
        score += 1
    if timestamp:
        score += 1
    if comment_id:
        score += 1

    if text and username and score >= 4:
        return True
    if text and timestamp and score >= 4:
        return True
    if text and COMMENT_HINT_RE.search(source_name) and score >= 3:
        return True
    return False


def extract_row(node: dict[str, Any], source_name: str, path_hint: str) -> dict[str, str]:
    flat_items = [
        (canonical_key(key), cleaned)
        for key, value in flatten_scalars(node)
        if (cleaned := clean_scalar(value)) is not None
    ]

    username = normalize_username(first_match(flat_items, USERNAME_KEYS))
    display_name = first_match(flat_items, DISPLAY_NAME_KEYS)
    text = first_match(flat_items, TEXT_KEYS)
    raw_timestamp = first_match(flat_items, TIMESTAMP_KEYS)
    timestamp_unix, timestamp_iso = parse_timestamp(raw_timestamp)
    media_uri = first_match(flat_items, MEDIA_URI_KEYS)
    post_url = pick_instagram_url([media_uri, text])
    comment_id = first_match(flat_items, COMMENT_ID_KEYS)
    parent_id = first_match(flat_items, PARENT_ID_KEYS)

    return {
        "source_file": source_name,
        "path_hint": path_hint,
        "comment_id": comment_id or "",
        "parent_id": parent_id or "",
        "is_reply": "true" if parent_id else "false",
        "username": username or "",
        "display_name": display_name or "",
        "comment_text": text or "",
        "timestamp_unix": timestamp_unix or "",
        "timestamp_iso_utc": timestamp_iso or "",
        "media_uri": media_uri or "",
        "post_url": post_url or "",
    }


def iter_comment_rows(node: Any, source_name: str, path: tuple[str, ...] = ()) -> Iterator[dict[str, str]]:
    if isinstance(node, dict):
        path_hint = ".".join(path)
        if looks_like_comment_dict(node, source_name, path_hint):
            yield extract_row(node, source_name, path_hint)
        for key, child in node.items():
            yield from iter_comment_rows(child, source_name, path + (str(key),))
        return

    if isinstance(node, list):
        for index, child in enumerate(node):
            yield from iter_comment_rows(child, source_name, path + (f"[{index}]",))


def dedupe_rows(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    unique_rows: list[dict[str, str]] = []
    for row in rows:
        key = (
            row["source_file"],
            row["comment_id"],
            row["username"],
            row["comment_text"],
            row["timestamp_iso_utc"],
            row["media_uri"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
    return unique_rows


def build_unique_commenters(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[str, dict[str, str | int]] = {}

    for row in rows:
        username = row["username"].strip()
        display_name = row["display_name"].strip()
        commenter_key = username.lower() if username else display_name.lower()
        if not commenter_key:
            continue

        current = grouped.get(commenter_key)
        if current is None:
            grouped[commenter_key] = {
                "username": username,
                "display_name": display_name,
                "comment_count": 1,
                "first_comment_at": row["timestamp_iso_utc"],
                "last_comment_at": row["timestamp_iso_utc"],
                "sample_comment": row["comment_text"],
            }
            continue

        current["comment_count"] = int(current["comment_count"]) + 1
        first_comment_at = str(current["first_comment_at"])
        last_comment_at = str(current["last_comment_at"])
        row_time = row["timestamp_iso_utc"]

        if row_time and (not first_comment_at or row_time < first_comment_at):
            current["first_comment_at"] = row_time
        if row_time and (not last_comment_at or row_time > last_comment_at):
            current["last_comment_at"] = row_time
        if not current["sample_comment"] and row["comment_text"]:
            current["sample_comment"] = row["comment_text"]

    output: list[dict[str, str]] = []
    for item in grouped.values():
        output.append(
            {
                "username": str(item["username"]),
                "display_name": str(item["display_name"]),
                "comment_count": str(item["comment_count"]),
                "first_comment_at": str(item["first_comment_at"]),
                "last_comment_at": str(item["last_comment_at"]),
                "sample_comment": str(item["sample_comment"]),
            }
        )

    output.sort(key=lambda item: (-int(item["comment_count"]), item["username"], item["display_name"]))
    return output


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_usernames_txt(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for row in rows:
        if row["username"]:
            lines.append(row["username"])
        elif row["display_name"]:
            lines.append(row["display_name"])
    path.write_text("\n".join(lines), encoding="utf-8")


def load_json_documents(input_path: Path) -> tuple[list[SourceFile], int]:
    if input_path.is_file() and input_path.suffix.lower() == ".zip":
        with zipfile.ZipFile(input_path) as archive:
            json_names = [
                name for name in archive.namelist()
                if name.lower().endswith(".json") and not name.endswith("/")
            ]
            comment_names = [name for name in json_names if COMMENT_HINT_RE.search(name)]
            selected_names = comment_names or json_names

            files: list[SourceFile] = []
            for name in selected_names:
                try:
                    text = archive.read(name).decode("utf-8")
                except UnicodeDecodeError:
                    text = archive.read(name).decode("utf-8", errors="replace")
                files.append(SourceFile(name=name, text=text))
            return files, len(json_names)

    if input_path.is_dir():
        all_json = [path for path in input_path.rglob("*.json") if path.is_file()]
        comment_json = [path for path in all_json if COMMENT_HINT_RE.search(str(path))]
        selected_paths = comment_json or all_json

        files = []
        for path in selected_paths:
            files.append(SourceFile(name=str(path.relative_to(input_path)), text=path.read_text(encoding="utf-8", errors="replace")))
        return files, len(all_json)

    raise FileNotFoundError(f"Input nao encontrado: {input_path}")


def default_output_dir(input_path: Path) -> Path:
    if input_path.is_file():
        return input_path.parent / f"{input_path.stem}-comments-csv"
    return input_path.parent / f"{input_path.name}-comments-csv"


def parse_documents(files: list[SourceFile], verbose: bool) -> tuple[list[dict[str, str]], int]:
    extracted_rows: list[dict[str, str]] = []
    parsed_files = 0

    for source in files:
        try:
            document = json.loads(source.text)
        except json.JSONDecodeError:
            if verbose:
                print(f"[skip] JSON invalido: {source.name}", file=sys.stderr)
            continue

        parsed_files += 1
        extracted_rows.extend(iter_comment_rows(document, source.name))

    return dedupe_rows(extracted_rows), parsed_files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Converte comentarios do export do Instagram em CSV para Excel."
    )
    parser.add_argument(
        "input_path",
        help="Caminho para o .zip do export do Instagram ou para a pasta extraida.",
    )
    parser.add_argument(
        "--out-dir",
        help="Pasta de saida. Se omitido, cria uma pasta ao lado do arquivo ou diretoria de entrada.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Mostra arquivos ignorados por JSON invalido.",
    )
    args = parser.parse_args()

    input_path = Path(args.input_path).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve() if args.out_dir else default_output_dir(input_path)

    files, total_json_files = load_json_documents(input_path)
    rows, parsed_files = parse_documents(files, verbose=args.verbose)
    unique_commenters = build_unique_commenters(rows)

    comments_csv = out_dir / "instagram_comments.csv"
    commenters_csv = out_dir / "instagram_commenters_unique.csv"
    commenters_txt = out_dir / "instagram_commenters_unique.txt"

    write_csv(
        comments_csv,
        rows,
        [
            "source_file",
            "path_hint",
            "comment_id",
            "parent_id",
            "is_reply",
            "username",
            "display_name",
            "comment_text",
            "timestamp_unix",
            "timestamp_iso_utc",
            "media_uri",
            "post_url",
        ],
    )
    write_csv(
        commenters_csv,
        unique_commenters,
        [
            "username",
            "display_name",
            "comment_count",
            "first_comment_at",
            "last_comment_at",
            "sample_comment",
        ],
    )
    write_usernames_txt(commenters_txt, unique_commenters)

    print(f"Entrada: {input_path}")
    print(f"JSON encontrados: {total_json_files}")
    print(f"JSON analisados: {parsed_files}")
    print(f"Comentarios extraidos: {len(rows)}")
    print(f"Comentaristas unicos: {len(unique_commenters)}")
    print(f"CSV comentarios: {comments_csv}")
    print(f"CSV comentaristas unicos: {commenters_csv}")
    print(f"TXT usernames: {commenters_txt}")

    if not rows:
        print(
            "Nenhum comentario foi encontrado. Tente exportar em JSON e incluir a categoria de comentarios.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
