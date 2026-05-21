from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from queue import Full, Queue
from threading import Lock, Thread
from typing import Any, Callable
import uuid

from .config import get_settings


settings = get_settings()


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


@dataclass
class _QueuedPublicJob:
    job_id: str
    worker: Callable[[], None]


class PublicProgressJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, PublicProgressJob] = {}
        self._lock = Lock()
        self._queue: Queue[_QueuedPublicJob] = Queue(maxsize=max(1, settings.public_job_queue_limit))
        self._workers_started = False
        self._worker_count = max(1, settings.public_job_worker_count)
        self._worker_lock = Lock()

    def _ensure_workers(self) -> None:
        if self._workers_started:
            return
        with self._worker_lock:
            if self._workers_started:
                return
            for index in range(self._worker_count):
                thread = Thread(
                    target=self._worker_loop,
                    name=f"fig-public-job-{index + 1}",
                    daemon=True,
                )
                thread.start()
            self._workers_started = True

    def _worker_loop(self) -> None:
        while True:
            queued_job = self._queue.get()
            try:
                self.update(
                    queued_job.job_id,
                    status="PROCESSANDO",
                    message=None,
                )
                try:
                    queued_job.worker()
                except Exception as err:  # pragma: no cover - defensive worker guard
                    self.update(
                        queued_job.job_id,
                        status="FALHOU",
                        error=str(err),
                        message=str(err),
                    )
            finally:
                self._queue.task_done()

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

    def discard(self, job_id: str) -> None:
        with self._lock:
            self._jobs.pop(job_id, None)

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

    def run(self, job_id: str, worker: Callable[[], None]) -> bool:
        self._ensure_workers()
        try:
            self._queue.put_nowait(_QueuedPublicJob(job_id=job_id, worker=worker))
        except Full:
            return False
        return True

    def queued_count(self) -> int:
        return self._queue.qsize()


public_progress_jobs = PublicProgressJobStore()
