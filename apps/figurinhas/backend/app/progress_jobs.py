from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import Lock, Thread
from typing import Any, Callable
import uuid


@dataclass
class PublicProgressJob:
    id: str
    job_type: str
    session_token: str
    album_slug: str | None
    title: str
    subtitle: str | None
    steps: list[str]
    status: str = "PENDENTE"
    progress: int = 0
    step_index: int = 0
    message: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class PublicProgressJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, PublicProgressJob] = {}
        self._lock = Lock()

    def _cleanup_locked(self) -> None:
        threshold = datetime.utcnow() - timedelta(hours=2)
        stale_ids = [job_id for job_id, job in self._jobs.items() if job.updated_at < threshold]
        for job_id in stale_ids:
            self._jobs.pop(job_id, None)

    def create(
        self,
        *,
        job_type: str,
        session_token: str,
        album_slug: str | None,
        title: str,
        subtitle: str | None,
        steps: list[str],
        initial_message: str | None = None,
    ) -> PublicProgressJob:
        with self._lock:
            self._cleanup_locked()
            job = PublicProgressJob(
                id=uuid.uuid4().hex,
                job_type=job_type,
                session_token=session_token.strip(),
                album_slug=album_slug,
                title=title,
                subtitle=subtitle,
                steps=steps,
                message=initial_message or (steps[0] if steps else None),
                status="PENDENTE",
                progress=0,
                step_index=0,
            )
            self._jobs[job.id] = job
            return job

    def get(self, job_id: str, *, session_token: str | None = None) -> PublicProgressJob | None:
        with self._lock:
            self._cleanup_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            if session_token is not None and job.session_token != session_token.strip():
                return None
            return job

    def update(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: int | None = None,
        step_index: int | None = None,
        message: str | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = max(0, min(100, int(progress)))
            if step_index is not None:
                job.step_index = max(0, min(step_index, max(len(job.steps) - 1, 0)))
            if message is not None:
                job.message = message
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
            job.updated_at = datetime.utcnow()

    def run(self, job_id: str, worker: Callable[[], None]) -> None:
        def _runner() -> None:
            try:
                worker()
            except Exception as err:  # pragma: no cover - defensive thread guard
                self.update(job_id, status="FALHOU", error=str(err))

        thread = Thread(target=_runner, daemon=True)
        thread.start()


public_progress_jobs = PublicProgressJobStore()

