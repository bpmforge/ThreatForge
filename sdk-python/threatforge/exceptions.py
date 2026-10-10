class ThreatForgeError(Exception):
    """Raised when the ThreatForge API returns an error response."""

    def __init__(self, message: str, status: int, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code

    def __repr__(self) -> str:
        return f"ThreatForgeError(status={self.status}, message={self!s})"
