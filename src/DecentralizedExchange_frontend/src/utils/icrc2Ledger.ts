import { Principal } from "@dfinity/principal";
import { token_a } from "../../../declarations/token_a";
import { token_b } from "../../../declarations/token_b";
import { canisterId as backendPrincipal } from "../../../declarations/DecentralizedExchange_backend";

export enum TokenSymbol {
  A = "A",
  B = "B",
}

export async function approve(tokenSymbol: TokenSymbol, amount: number) {
  return await getLedger(tokenSymbol).icrc2_approve({
    spender: { owner: Principal.fromText(backendPrincipal), subaccount: [] },
    amount: BigInt(amount),
    fee: [],
    memo: [],
    from_subaccount: [],
    created_at_time: [],
    expected_allowance: [],
    expires_at: [],
  });
}

export async function tokenBalance(tokenSymbol: TokenSymbol, owner: Principal) {
  const balance = await getLedger(tokenSymbol).icrc1_balance_of({
    owner,
    subaccount: [],
  });
  return balance;
}

export function transferFee(tokenSymbol: TokenSymbol) {
  return getLedger(tokenSymbol).icrc1_fee();
}

function getLedger(tokenSymbol: TokenSymbol) {
  return { [TokenSymbol.A]: token_a, [TokenSymbol.B]: token_b }[tokenSymbol];
}
