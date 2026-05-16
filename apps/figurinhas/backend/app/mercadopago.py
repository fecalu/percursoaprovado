from __future__ import annotations

import base64
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx


class MercadoPagoError(Exception):
    pass


@dataclass
class PixPayment:
    payment_id: str
    external_reference: str
    status: str
    status_detail: str | None
    qr_code_base64: str | None
    qr_code: str | None
    ticket_url: str | None
    expires_at: datetime | None
    paid_at: datetime | None


class MercadoPagoPixClient:
    def __init__(self, access_token: str) -> None:
        self.access_token = access_token.strip()
        if not self.access_token:
            raise MercadoPagoError("Mercado Pago nao configurado para liberar a Minha Figurinha.")

    def create_pix_payment(
        self,
        *,
        amount_cents: int,
        description: str,
        payer_email: str,
        external_reference: str,
    ) -> PixPayment:
        expiration = datetime.now(UTC) + timedelta(hours=24)
        expiration_text = expiration.strftime("%Y-%m-%dT%H:%M:%S%z")
        if expiration_text.endswith("+0000"):
            expiration_text = expiration_text[:-5] + "Z"
        payload = {
            "transaction_amount": round(amount_cents / 100, 2),
            "description": description,
            "payment_method_id": "pix",
            "date_of_expiration": expiration_text,
            "external_reference": external_reference,
            "payer": {
                "email": payer_email,
            },
        }
        data = self._request(
            "POST",
            "https://api.mercadopago.com/v1/payments",
            json=payload,
            extra_headers={"X-Idempotency-Key": uuid.uuid4().hex},
        )
        return self._parse_payment(data)

    def get_payment(self, payment_id: str) -> PixPayment:
        data = self._request("GET", f"https://api.mercadopago.com/v1/payments/{payment_id}")
        return self._parse_payment(data)

    def _request(self, method: str, url: str, *, json: dict | None = None, extra_headers: dict | None = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }
        if extra_headers:
            headers.update(extra_headers)
        try:
            response = httpx.request(method, url, headers=headers, json=json, timeout=25.0)
        except httpx.HTTPError as exc:
            raise MercadoPagoError("Nao foi possivel se comunicar com o Mercado Pago agora.") from exc

        if response.status_code >= 400:
            detail = self._extract_error_detail(response)
            raise MercadoPagoError(detail)

        try:
            return response.json()
        except ValueError as exc:
            raise MercadoPagoError("Mercado Pago retornou uma resposta invalida.") from exc

    def _extract_error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return f"Mercado Pago respondeu com erro {response.status_code}."

        message = payload.get("message") or payload.get("error") or payload.get("cause")
        if isinstance(message, list) and message:
            first = message[0]
            if isinstance(first, dict):
                return first.get("description") or first.get("code") or f"Mercado Pago respondeu com erro {response.status_code}."
            return str(first)
        if isinstance(message, dict):
            return message.get("description") or message.get("message") or f"Mercado Pago respondeu com erro {response.status_code}."
        if isinstance(message, str) and message.strip():
            return message
        return f"Mercado Pago respondeu com erro {response.status_code}."

    def _parse_payment(self, payload: dict) -> PixPayment:
        point = payload.get("point_of_interaction") or {}
        transaction_data = point.get("transaction_data") or {}
        qr_code_base64 = transaction_data.get("qr_code_base64")
        if qr_code_base64:
            try:
                base64.b64decode(qr_code_base64, validate=False)
            except Exception:
                qr_code_base64 = None

        paid_at = None
        if payload.get("date_approved"):
            paid_at = self._parse_datetime(payload.get("date_approved"))

        expires_at = None
        if payload.get("date_of_expiration"):
            expires_at = self._parse_datetime(payload.get("date_of_expiration"))

        return PixPayment(
            payment_id=str(payload.get("id") or ""),
            external_reference=str(payload.get("external_reference") or ""),
            status=str(payload.get("status") or ""),
            status_detail=payload.get("status_detail"),
            qr_code_base64=qr_code_base64,
            qr_code=transaction_data.get("qr_code"),
            ticket_url=transaction_data.get("ticket_url"),
            expires_at=expires_at,
            paid_at=paid_at,
        )

    def _parse_datetime(self, value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
