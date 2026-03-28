"""AgentCore Runtime 用エントリポイント（トップレベル）。"""

from src.agentcore_entry import app  # noqa: F401

if __name__ == "__main__":
    app.run()
