"""ThreatForge Python SDK — HTTP client and resource accessors."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from .exceptions import ThreatForgeError

DEFAULT_BASE_URL = "http://localhost:3001"
DEFAULT_TIMEOUT = 30


class _HttpClient:
    def __init__(self, api_key: str, base_url: str, timeout: int) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _url(self, path: str, params: dict[str, Any] | None = None) -> str:
        url = self._base_url + path
        if params:
            filtered = {k: v for k, v in params.items() if v is not None}
            if filtered:
                url += "?" + urlencode(filtered)
        return url

    def _request(
        self,
        method: str,
        path: str,
        body: Any = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        url = self._url(path, params)
        data = json.dumps(body).encode() if body is not None else None
        req = Request(url, data=data, headers=self._headers(), method=method)
        try:
            with urlopen(req, timeout=self._timeout) as resp:
                if resp.status == 204:
                    return None
                payload = json.loads(resp.read())
                return payload.get("data", payload)
        except HTTPError as e:
            msg = str(e.reason)
            try:
                body_bytes = e.read()
                err_json = json.loads(body_bytes)
                msg = err_json.get("error") or err_json.get("message") or msg
            except Exception:
                pass
            raise ThreatForgeError(msg, e.code) from e
        except URLError as e:
            raise ThreatForgeError(f"Network error: {e.reason}", 0) from e

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params)

    def post(self, path: str, body: Any = None) -> Any:
        return self._request("POST", path, body=body)

    def put(self, path: str, body: Any = None) -> Any:
        return self._request("PUT", path, body=body)

    def patch(self, path: str, body: Any = None) -> Any:
        return self._request("PATCH", path, body=body)

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)


class _ModelsResource:
    def __init__(self, http: _HttpClient) -> None:
        self._http = http

    def list(self, *, page: int = 1, limit: int = 20, project_id: str | None = None, search: str | None = None) -> dict:
        return self._http.get("/api/threat-models", {"page": page, "limit": limit, "projectId": project_id, "search": search})

    def get(self, model_id: str) -> dict:
        return self._http.get(f"/api/threat-models/{model_id}")

    def create(self, name: str, project_id: str, **kwargs: Any) -> dict:
        return self._http.post("/api/threat-models", {"name": name, "projectId": project_id, **kwargs})

    def update(self, model_id: str, **kwargs: Any) -> dict:
        return self._http.put(f"/api/threat-models/{model_id}", kwargs)

    def delete(self, model_id: str) -> None:
        self._http.delete(f"/api/threat-models/{model_id}")

    def create_from_github(self, repo_url: str, token: str | None = None) -> dict:
        return self._http.post("/api/threat-models/create-from-github", {"repoUrl": repo_url, "token": token})


class _ThreatsResource:
    def __init__(self, http: _HttpClient) -> None:
        self._http = http

    def list(self, model_id: str, *, page: int = 1, limit: int = 50, severity: str | None = None, status: str | None = None) -> dict:
        return self._http.get(f"/api/threat-models/{model_id}/threats", {"page": page, "limit": limit, "severity": severity, "status": status})

    def get(self, model_id: str, threat_id: str) -> dict:
        return self._http.get(f"/api/threat-models/{model_id}/threats/{threat_id}")

    def create(self, model_id: str, name: str, **kwargs: Any) -> dict:
        return self._http.post(f"/api/threat-models/{model_id}/threats", {"name": name, **kwargs})

    def update(self, model_id: str, threat_id: str, **kwargs: Any) -> dict:
        return self._http.put(f"/api/threat-models/{model_id}/threats/{threat_id}", kwargs)

    def update_status(self, model_id: str, threat_id: str, status: str) -> dict:
        return self._http.patch(f"/api/threat-models/{model_id}/threats/{threat_id}", {"status": status})

    def delete(self, model_id: str, threat_id: str) -> None:
        self._http.delete(f"/api/threat-models/{model_id}/threats/{threat_id}")

    def suggest_threats(self, model_id: str) -> dict:
        return self._http.post(f"/api/threat-models/{model_id}/ai/suggest-threats")


class _MitigationsResource:
    def __init__(self, http: _HttpClient) -> None:
        self._http = http

    def list(self, threat_id: str) -> list:
        return self._http.get(f"/api/threats/{threat_id}/mitigations")

    def create(self, threat_id: str, description: str, **kwargs: Any) -> dict:
        return self._http.post(f"/api/threats/{threat_id}/mitigations", {"description": description, **kwargs})

    def update_status(self, threat_id: str, mitigation_id: str, status: str) -> dict:
        return self._http.patch(f"/api/threats/{threat_id}/mitigations/{mitigation_id}", {"status": status})

    def delete(self, threat_id: str, mitigation_id: str) -> None:
        self._http.delete(f"/api/threats/{threat_id}/mitigations/{mitigation_id}")


class _ProjectsResource:
    def __init__(self, http: _HttpClient) -> None:
        self._http = http

    def list(self, *, page: int = 1, limit: int = 20, organization_id: str | None = None) -> dict:
        return self._http.get("/api/projects", {"page": page, "limit": limit, "organizationId": organization_id})

    def get(self, project_id: str) -> dict:
        return self._http.get(f"/api/projects/{project_id}")

    def create(self, name: str, organization_id: str, **kwargs: Any) -> dict:
        return self._http.post("/api/projects", {"name": name, "organizationId": organization_id, **kwargs})

    def delete(self, project_id: str) -> None:
        self._http.delete(f"/api/projects/{project_id}")


class ThreatForgeClient:
    """Official Python client for the ThreatForge API.

    Example::

        from threatforge import ThreatForgeClient

        client = ThreatForgeClient(api_key="ftm_...")
        models = client.models.list()
        threats = client.threats.list(models["data"][0]["id"])
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        http = _HttpClient(api_key, base_url, timeout)
        self.models = _ModelsResource(http)
        self.threats = _ThreatsResource(http)
        self.mitigations = _MitigationsResource(http)
        self.projects = _ProjectsResource(http)
