import "./SwapList.scss";
import { useEffect, useState } from "react";
import { SwapRequest } from "../../declarations/DecentralizedExchange_backend/DecentralizedExchange_backend.did";
import { DecentralizedExchange_backend } from "../../declarations/DecentralizedExchange_backend";

function SwapList() {
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchSwaps = async () => {
    const result = await DecentralizedExchange_backend.listSwapRequest();
    setSwapRequests(result);
  };

  useEffect(() => {
    fetchSwaps();
  }, []);

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 1e8)
      .toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 8,
      })
      .replace(/\.?0+$/, "");
  };

  const onSwap = async (id: bigint) => {
    try {
      setSaving(true);
      const result = await DecentralizedExchange_backend.acceptSwapRequest(id);
      if ("err" in result) {
        throw new Error(Object.keys(result.err)[0]);
      }
      fetchSwaps();
    } catch (error: any) {
      const errorText: string = error.toString();
      alert(errorText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="swap-list-container">
      <h2 className="swap-list-title">Swap Requests</h2>
      {swapRequests.length === 0 ? (
        <p className="no-swaps">No swap requests available.</p>
      ) : (
        <ul className="swap-list">
          {swapRequests.map((request) => (
            <li key={request.id.toString()} className="swap-item">
              <div className="swap-details">
                <p>
                  <strong>From:</strong> {request.fromToken} →{" "}
                  <strong>To:</strong> {request.toToken}
                </p>
                <p>
                  <strong>Amount:</strong> {formatAmount(request.amount)}
                </p>
                <p className="creator">
                  <strong>Creator:</strong> {request.creator.toText()}
                </p>
              </div>
              <button
                className="swap-button"
                onClick={() => onSwap(request.id)}
                disabled={saving}
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                Swap
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SwapList;
