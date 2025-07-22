import "./Account.scss";
import { useEffect, useState } from "react";
import {
  approve,
  tokenBalance,
  TokenSymbol,
  transferFee,
} from "./utils/icrc2Ledger";
import { useAuth } from "./use-auth-client";
import { DecentralizedExchange_backend } from "../../declarations/DecentralizedExchange_backend";

function Account() {
  const [balanceA, setBalanceA] = useState<bigint>(0n);
  const [balanceB, setBalanceB] = useState<bigint>(0n);
  const [balanceInContractA, setbalanceInContractA] = useState<bigint>(0n);
  const [balanceInContractB, setbalanceInContractB] = useState<bigint>(0n);
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>(
    TokenSymbol.A
  );
  const [amount, setAmount] = useState<number>(1);
  const [lastError, setLastError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const { principal } = useAuth();

  const fetchFromBackend = () => {
    if (!principal) {
      return;
    }
    const setters = [
      setBalanceA,
      setBalanceB,
      setbalanceInContractA,
      setbalanceInContractB,
    ];

    Promise.all([
      tokenBalance(TokenSymbol.A, principal),
      tokenBalance(TokenSymbol.B, principal),
      DecentralizedExchange_backend.getBalance(TokenSymbol.A),
      DecentralizedExchange_backend.getBalance(TokenSymbol.B),
    ]).then((values) => values.forEach((value, idx) => setters[idx](value)));
  };

  useEffect(() => {
    fetchFromBackend();
  }, [principal]);

  function balanceToString(balance: bigint) {
    return (Number(balance) / 1e8)
      .toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 8,
      })
      .replace(/\.?0+$/, "");
  }

  const handleDeposit = async () => {
    const fee = Number(await transferFee(selectedToken));
    const balance = Number(await tokenBalance(selectedToken, principal!));

    if (balance < amount * 1e8 + fee) {
      setLastError("Insufficient balance");
      return;
    }
    try {
      setSaving(true);
      await approve(selectedToken, amount * 1e8 + fee);
      const result = await DecentralizedExchange_backend.deposit(
        selectedToken,
        BigInt(amount * 1e8)
      );
      if ("err" in result) {
        throw new Error(Object.keys(result.err)[0]);
      }
      setLastError(undefined);
      setAmount(1);
      setSelectedToken(TokenSymbol.A);
      fetchFromBackend();
    } catch (error: any) {
      const errorText: string = error.toString();
      setLastError(errorText);
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setSaving(true);
      const result = await DecentralizedExchange_backend.withdraw(
        selectedToken,
        BigInt(amount * 1e8)
      );
      if ("err" in result) {
        throw new Error(Object.keys(result.err)[0]);
      }
      setLastError(undefined);
      setAmount(1);
      setSelectedToken(TokenSymbol.A);
      fetchFromBackend();
    } catch (error: any) {
      const errorText: string = error.toString();
      setLastError(errorText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-wrapper">
      {/* Left side: Balances */}
      <div className="balance-section">
        <div className="account-container">
          <h2 className="account-title">Your Balances</h2>
          <div className="balance-box">
            <p className="balance-item">
              <span className="token-name">Token A:</span>
              <span className="token-balance">
                {balanceToString(balanceA)} A
              </span>
            </p>
            <p className="balance-item">
              <span className="token-name">Token B:</span>
              <span className="token-balance">
                {balanceToString(balanceB)} B
              </span>
            </p>
          </div>
        </div>

        <div className="account-container">
          <h2 className="account-title">Your Balances In Contract</h2>
          <div className="balance-box">
            <p className="balance-item">
              <span className="token-name">Token A:</span>
              <span className="token-balance">
                {balanceToString(balanceInContractA)} A
              </span>
            </p>
            <p className="balance-item">
              <span className="token-name">Token B:</span>
              <span className="token-balance">
                {balanceToString(balanceInContractB)} B
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="form-section">
        <div className="account-container">
          <h2 className="account-title">Deposit / Withdraw</h2>
          <form
            className="transaction-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="form-label">Select Token:</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as TokenSymbol)}
              className="form-select"
            >
              <option value={TokenSymbol.A}>Token A</option>
              <option value={TokenSymbol.B}>Token B</option>
            </select>

            <label className="form-label">Amount:</label>
            <input
              type="number"
              step="1"
              value={amount}
              min={1}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="form-input"
            />

            <div className="button-group">
              <button
                type="button"
                className="deposit-button"
                onClick={handleDeposit}
                disabled={saving}
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                Deposit
              </button>
              <button
                type="button"
                className="withdraw-button"
                onClick={handleWithdraw}
                disabled={saving}
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                Withdraw
              </button>
            </div>
            {lastError != null && <p className="error-message">{lastError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Account;
