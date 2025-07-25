import "./SwapForm.scss";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DecentralizedExchange_backend } from "../../declarations/DecentralizedExchange_backend";
import { useAuth } from "./use-auth-client";
import { TokenSymbol } from "./utils/icrc2Ledger";
import { SwapRequestPayload } from "../../declarations/DecentralizedExchange_backend/DecentralizedExchange_backend.did";

function CreateSwap() {
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>(undefined);
  const [fromToken, setFromToken] = useState<TokenSymbol>(TokenSymbol.A);
  const [toToken, setToToken] = useState<TokenSymbol>(TokenSymbol.B);
  const [amount, setAmount] = useState<number>(1);

  const navigate = useNavigate();

  const { principal } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromToken === toToken) {
      setLastError("tokens must be different");
      return;
    }
    try {
      setSaving(true);
      const swapData: SwapRequestPayload = {
        fromToken,
        amount: BigInt(Math.round(Number(amount) * 1e8)),
        toToken,
      };
      const result = await DecentralizedExchange_backend.createSwapRequest(swapData);
      if ("err" in result) {
        throw new Error(Object.keys(result.err)[0]);
      }
      navigate("/");
    } catch (error: any) {
      const errorText: string = error.toString();
      setLastError(errorText);
    } finally {
      setSaving(false);
    }
  };

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <div className="swap-form-container">
      <h2 className="swap-title">Create Token Swap</h2>
      <form className="swap-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">From Token</label>
          <select
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value as TokenSymbol)}
            className="form-select"
          >
            <option value={TokenSymbol.A}>Token A</option>
            <option value={TokenSymbol.B}>Token B</option>
          </select>
        </div>

        <div className="swap-toggle-container">
          <button
            type="button"
            className="swap-toggle"
            onClick={handleSwapTokens}
            title="Swap tokens"
          >
            ⇄
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">To Token</label>
          <select
            value={toToken}
            onChange={(e) => setToToken(e.target.value as TokenSymbol)}
            className="form-select"
          >
            <option value={TokenSymbol.A}>Token A</option>
            <option value={TokenSymbol.B}>Token B</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Amount</label>
          <input
            type="number"
            step="1"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="form-input"
            placeholder="Enter amount to swap"
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="swap-button"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Swap Request'}
          </button>
        </div>
        
        {lastError != null && (
          <p className="error-message">{lastError}</p>
        )}
      </form>
    </div>
  );
}

export default CreateSwap;
